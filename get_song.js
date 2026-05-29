const config = require('./config.json')

const DEBUG = false

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
const getTrackFromPlayer = async (token) => {
	const url = `https://api.spotify.com/v1/me/player/currently-playing`

	const options = {
		method: 'GET',
		headers: { 'Authorization': `Bearer ${token}` },
	}

	const res = await fetch(url, options)
	const data = await res.json()

	console.log('Song Got')
	console.log(data.item.name) // %output1%

	const names = []
	for(const artist of data.item.artists) names.push(artist.name)
	console.log(names.join(', ')) // %output2%
}

//run
const run = async () => {
	const auth = await refreshToken()
	const token = auth?.access_token
	if(!token) return

	await getTrackFromPlayer(token)
}

run()
