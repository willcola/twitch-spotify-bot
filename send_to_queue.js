const config = require('./config.json')

// cli
const parseCliArgs = () => {
	const args = process.argv.slice(2)
	let debug = false
	const inputParts = []

	for(let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === '--debug' || arg === '-d') debug = true
		else if((arg === '--input' || arg === '-i') && args[i + 1]) inputParts.push(args[++i])
		else if(arg === '--help' || arg === '-h') return { help: true }
		else if(!arg.startsWith('-')) inputParts.push(arg)
	}

	return {
		debug,
		input: inputParts.join(' ') || process.env.URL,
	}
}
const cli = parseCliArgs()
if (cli.help) {
	console.log(`Usage: node send_to_queue.js [options] [song input]

Options:
  -d, --debug          Enable debug logging
  -i, --input <value>  Song name, Spotify URL, or YouTube URL to queue
  -h, --help           Show this help message

Examples:
  node send_to_queue.js --debug "Lullaby by Bennett"
  node send_to_queue.js -d "Lullaby - Bennett"
  node send_to_queue.js "https://open.spotify.com/track/67aNGns9ZH1jm6nruyzBGU"
  node send_to_queue.js -d "https://www.youtube.com/watch?v=PD12zGuqSRY"

If no input is passed, the URL environment variable is used (Streamer.bot).`)
	process.exit(0)
}
const URL = cli.input
const DEBUG = cli.debug

// all of the things
const normalizeInput = (input) => {
	let normalized = input.trim()
	try { normalized = decodeURIComponent(normalized) }
	catch(e) {}
	return normalized.trim()
}
const parseSongQuery = (input) => {
	const trimmed = normalizeInput(input)
	
	const byMatch = trimmed.match(/^(.+?)\s+by\s+(.+)$/i)
	if(byMatch) return { track: byMatch[1].trim(), artist: byMatch[2].trim() }
	
	const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/)
	if(dashMatch) return { track: dashMatch[1].trim(), artist: dashMatch[2].trim() }

	return { track: trimmed, artist: null }
}
const buildSearchQuery = ({ track, artist }) => {
	if(artist) return `track:${track} artist:${artist}`
	return track
}
const logSpotifyMatch = (track) => {
	if(!DEBUG || !track) return
	console.log('SPOTIFY MATCH:', {
		name: track.name,
		artists: track.artists.map(a => a.name).join(', '),
		url: track.external_urls?.spotify,
	})
}
const searchTrackByParts = async (token, parts) => {
	const query = buildSearchQuery(parts)
	const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
		q: query,
		type: 'track',
		limit: '1',
	})}`

	const options = {
		method: 'GET',
		headers: { 'Authorization': `Bearer ${token}` },
	}

	if(DEBUG) console.log('SEARCHING TRACK...', { url, query })

	const res = await fetch(url, options)
	const data = await res.json()

	if(DEBUG) console.log('SEARCH RESULT', { data })

	return data?.tracks?.items?.[0] ?? null
}
const searchTrack = async (token, input) => {
	return searchTrackByParts(token, parseSongQuery(input))
}
const searchTrackWithArtistFallback = async (token, parts) => {
	let track = await searchTrackByParts(token, parts)
	if(track || !parts.artist) return track

	if(DEBUG) console.log('RETRYING WITH SWAPPED ARTIST/TRACK...', {
		track: parts.artist,
		artist: parts.track,
	})

	return searchTrackByParts(token, { track: parts.artist, artist: parts.track })
}
const isYouTubeUrl = (input) => {
	const normalized = normalizeInput(input)
	return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(normalized)
}
const getYouTubeTitle = async (url) => {
	const oembedUrl = `https://www.youtube.com/oembed?${new URLSearchParams({
		url: normalizeInput(url),
		format: 'json',
	})}`

	if(DEBUG) console.log('FETCHING YOUTUBE OEMBED...', { url: oembedUrl })

	const res = await fetch(oembedUrl)
	if(!res.ok) {
		if(DEBUG) console.log('YOUTUBE OEMBED FAILED:', res.status)
		return null
	}

	const data = await res.json()
	return data?.title ?? null
}
const cleanYouTubeTitle = (title) => {
	let cleaned = title.trim()
	cleaned = cleaned.replace(/\s+-\s+Topic$/i, '')
	cleaned = cleaned.replace(/\s*\|[^|]*$/g, '')
	cleaned = cleaned.replace(/\s*\([^)]*\)/g, (match) => {
		if(/official|lyric|audio|video|visualizer|hd|4k|live|remix|extended|prod\.?/i.test(match)) return ''
		return match
	})
	cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, (match) => {
		if(/official|lyric|audio|video|visualizer|hd|4k|live|remix|extended/i.test(match)) return ''
		return match
	})
	return cleaned.trim()
}
const parseYouTubeTitle = (title) => {
	const trimmed = cleanYouTubeTitle(title)
	
	const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/)
	if(dashMatch) return { track: dashMatch[2].trim(), artist: dashMatch[1].trim() }
	
	const byMatch = trimmed.match(/^(.+?)\s+by\s+(.+)$/i)
	if(byMatch) return { track: byMatch[1].trim(), artist: byMatch[2].trim() }
	
	return { track: trimmed, artist: null }
}
const getTrackIdFromUrl = (url) => {
	let sanitized = normalizeInput(url)
	sanitized = sanitized.replace(/["'<>]/g, '').replace(/\s/g, '')
	const match = sanitized.match(/track[:/]([a-zA-Z0-9]{22})/)
	if(!match) return

	const trackId = match[1]
	if(!/^[a-zA-Z0-9]{22}$/.test(trackId)) throw new Error({message: 'invalid trackId...', trackId})

	return trackId
}
const resolveTrackId = async (token, input) => {
	const trackId = getTrackIdFromUrl(input)
	if(trackId) return trackId

	if(isYouTubeUrl(input)) {
		const title = await getYouTubeTitle(input)
		if(!title) return null

		const parts = parseYouTubeTitle(title)
		if(DEBUG) {
			console.log('YOUTUBE URL:', input)
			console.log('YOUTUBE TITLE:', title)
			console.log('CLEANED TITLE:', cleanYouTubeTitle(title))
			console.log('SEARCH PARTS:', parts)
		}

		const track = await searchTrackWithArtistFallback(token, parts)
		logSpotifyMatch(track)
		return track?.id ?? null
	}

	const track = await searchTrack(token, input)
	logSpotifyMatch(track)
	return track?.id ?? null
}
const refreshToken = async () => {
	const url = 'https://accounts.spotify.com/api/token'

	const options = {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			'Authorization': 'Basic ' + (new Buffer.from(config.id + ':' + config.secret).toString('base64'))
		},
		body: `grant_type=refresh_token&refresh_token=${config.refresh_token}&client_id=${config.id}`,
	}

	if(DEBUG) console.log('REFRESH TOKEN...', {url,options})

	const res = await fetch(url, options)
	const data = await res.json()

	if(DEBUG) console.log('TOKEN REFRESHED', {data})

	return data
}
const getDeviceId = async (token) => {
	const url = `https://api.spotify.com/v1/me/player/devices`

	const options = {
		method: 'GET',
		headers: { 'Authorization': `Bearer ${token}` },
	}

	if(DEBUG) console.log('GETTING DEVICE...', {url,options})

	const res = await fetch(url, options)
	const data = await res.json()

	if(DEBUG) console.log('GOT DEVICE', {data})

	const activeDevice = data?.devices?.find(e => e.is_active)
	const deviceId = activeDevice?.id

	return deviceId
}
const addSongToQueue = async (token, deviceId, trackId='6oRVdEIoIzZCbay6vDDSwf') => {
	const uri = encodeURI(`spotify:track:${trackId}`)
	const url = `https://api.spotify.com/v1/me/player/queue?uri=${uri}&device_id=${deviceId}`

	const options = {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}` },
	}

	if(DEBUG) console.log('ADDING TO QUEUE...', {url,options})

	const res = await fetch(url, options)
	const data = await res.text()

	if(DEBUG) console.log('ADDING SONG', res)

	options.method = 'GET'
	const res2 = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, options)
	const data2 = await res2.json()

	console.log('Song Added')
	console.log(data2.name) // %output1%

	const names = []
	for(const artist of data2.artists) names.push(artist.name)
	console.log(names.join(', ')) // %output2%
}

//run
const run = async () => {
	//might wana add some error notifications if shit fails :)

	if (!URL) {
		console.log('No input provided. Pass a song name/URL or set the URL env var.')
		console.log('Example: node send_to_queue.js --debug "Lullaby by Bennett"')
		return
	}

	if (DEBUG) console.log('INPUT:', URL)

	const auth = await refreshToken()
	const token = auth?.access_token
	if(!token) return

	const trackId = await resolveTrackId(token, URL)
	if(!trackId) return

	const deviceId = await getDeviceId(token)
	if(!deviceId) return

	await addSongToQueue(token, deviceId, trackId)
}

run()
