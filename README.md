# twitch-spotify-bot

## What does it do?

Allows viewers to add songs to your Spotify queue while you're streaming. Make sure Spotify is actively playing on one of your devices; otherwise, the bot won't know which device's queue to add the song to.

## What is supported?

### Spotify track links

    https://open.spotify.com/track/67aNGns9ZH1jm6nruyzBGU?si=a9ee7f79f3c04063

### Song search

The bot simply picks the first result, but it does support including the artist in the search.

    Lullaby by Bennett

    Lullaby - Bennett

    Lullaby

### YouTube links

The bot does its best to extract the artist and song title from the YouTube video's oEmbed data. Works most of the time :)

    https://youtu.be/Cd1yeOGcL84?si=wYjhKnpbYPxM8-dH

    https://youtu.be/PD12zGuqSRY?si=JSjD_yZwLi-q_FcR

## Requirements

A Spotify Premium account. I have a vague memory of helping someone set this up with a family plan account and it not working. Just make sure you have an actual Premium account; otherwise, you won't be able to authenticate with Spotify and obtain the permissions required to modify your queue through the API.

## Setup

Install Node.js. Both the Spotify authentication setup and Streamer.bot will need it to run the bot.

    https://nodejs.org/en/download

Once that's done, go to developer.spotify.com and log in.

    https://developer.spotify.com/

Then click your name in the top-right corner and open the Dashboard.

Here you're going to create a Spotify application that the bot will use to authenticate and communicate with the Spotify API.

![img](/docs/Screenshot%202026-05-29%20111338.png?raw=true "")

The Name and Description can be whatever you'd like.

Set the "Redirect URIs" to:

    http://127.0.0.1:8888/callback

Make sure "Web API" is checked.

![img](/docs/Screenshot%202026-05-29%20111954.png?raw=true "")

Once it's created, you'll have a Client ID and Client Secret. You'll need these to set up the bot's authentication.

![img](/docs/Screenshot%202026-05-29%20112142.png?raw=true "")

Now you need to download the bot. If you already have Git installed, just clone the repository wherever you'd like to keep the scripts. If not, and you're unfamiliar with Git, just download the ZIP file and extract it. I'd recommend extracting it somewhere you'll want to keep your Streamer.bot scripts.

![img](/docs/Screenshot%202026-05-29%20110502.png?raw=true "")

Open a terminal in the folder. On Windows, you can do this by typing "cmd" in the address bar and pressing Enter.

![img](/docs/Screenshot%202026-05-29%20112931.png?raw=true "")

In the terminal, run:

    npm install

This installs the bot's dependencies.

Then run:

    node get_auth_code.js

You will be prompted to enter the Client ID and Client Secret from your Spotify application.

Once that's done, open:

    http://localhost:8888/login

and authenticate with Spotify.

Your terminal should look like this once you've successfully authenticated.

![img](/docs/Screenshot%202026-05-29%20113807.png?raw=true "")

If you'd like to verify that the bot is working correctly, make sure Spotify is open and actively playing, then run:

    node send_to_queue.js "Lullaby by Bennett"

You should see the song appear in your queue.

![img](/docs/Screenshot%202026-05-29%20114214.png?raw=true "")

Now you just need to connect the bot to Streamer.bot.

In Streamer.bot, go to your Twitch channel point rewards and create a song request redemption.

![img](/docs/Screenshot%202026-05-29%20114857.png?raw=true "")

Go to "Actions" under "Actions & Queues".

Create a new action.

![img](/docs/Screenshot%202026-05-29%20115014.png?raw=true "")

Under the action's triggers, right-click and select:

    Add -> Twitch -> Channel Reward -> Reward Redemption

Then choose the channel point reward you created.

![img](/docs/Screenshot%202026-05-29%20115319.png?raw=true "")

Under Sub-Actions, right-click and select:

    Add -> Core -> System -> Run a Program

![img](/docs/Screenshot%202026-05-29%20115618.png?raw=true "")

Set "Target" to:

    node

Set "Working Directory" to the folder where the scripts are located.

![img](/docs/Screenshot%202026-05-29%20115618.png?raw=true "")

"Arguments" should contain the script you want to run.

Add an environment variable named "url" and set it to:

    %rawInput%

All this does is run the following command from the scripts directory:

    node send_to_queue.js

The bot will then use the user's channel point redemption input from the environment variable.

"Wait Maximum" needs to be greater than 0 if you want to use the bot's outputs. I set mine to 5 seconds just to be safe.

Under Sub-Actions, right-click and select:

    Add -> Core -> Logic -> If/Else

![img](/docs/Screenshot%202026-05-29%20120724.png?raw=true "")

Input:

    %output0%

Value:

    Song Added

Under the "True Result", right-click and select:

    Add -> Twitch -> Chat -> Send Message to Channel

![img](/docs/Screenshot%202026-05-29%20121028.png?raw=true "")

This message can be anything; it just lets viewers know that a song was added. I use:

    Song Added: %output1% - %output2%

"%output1%" is the song title and "%output2%" is the artist.

Under the "False Result", right-click and select:

    Add -> Twitch -> Chat -> Send Message to Channel

    failed to add song...

Again, this message can be anything you'd like.

Your bot is now ready :)

## (Optional) Add a current song command

Create another action and name it whatever you'd like.

Under Triggers, select:

    Add -> Core -> Commands -> Command Triggered

Then create a new command.

![img](/docs/Screenshot%202026-05-29%20121657.png?raw=true "")

Under Sub-Actions, add the same "Run a Program", "If/Else", and "Send Message to Channel" actions that you used previously.

![img](/docs/Screenshot%202026-05-29%20121932.png?raw=true "")
![img](/docs/Screenshot%202026-05-29%20121951.png?raw=true "")
![img](/docs/Screenshot%202026-05-29%20122010.png?raw=true "")
![img](/docs/Screenshot%202026-05-29%20122028.png?raw=true "")

## (Optional) Add a song request command

Create another action and name it whatever you'd like.

Under Triggers, select:

    Add -> Core -> Commands -> Command Triggered

Then create a new command.

![img](/docs/Screenshot%202026-05-29%20122347.png?raw=true "")

From here, you can simply copy the sub-actions from your channel point redemption action and paste them into this command's Sub-Actions.

![img](/docs/Screenshot%202026-05-29%20122616.png?raw=true "")
![img](/docs/Screenshot%202026-05-29%20122743.png?raw=true "")

You don't need to edit any of the sub-action values.