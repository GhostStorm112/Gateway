const { Client: Lavaqueue } = require('lavaqueue')

class Lavalink extends Lavaqueue {
  constructor (options = {}) {
    super({
      userID: options.user,
      password: options.password,
      hosts: {
        rest: options.rest,
        ws: options.ws,
        redis: options.redis
      }
    })

    this.channel = options.gateway
    this.redis = options.redis
  }

  async recover () {
    const players = await this.redis.storage.get('players', { type: 'arr' })
    console.log(players)
    if (players) {
      for (const player of players) {
        if (player.channel_id) {
          await this.channel.sendToQueue('weather-gateway-requests', Buffer.from(JSON.stringify({
            t: 'VOICE_STATE_UPDATE',
            d: {
              guild_id: player.guild_id,
              channel_id: player.channel_id,
              self_mute: false,
              self_deaf: false
            }
          })))
        }
      }
      await this.queues.start()
    }
  }
  async skip (guildId) {
    await this.queues.get(guildId).next()
  }

  async stop (guildId) {
    await this.queues.get(guildId).stop()
  }

  async send (event) {
    return this.channel.sendToQueue('weather-gateway-requests', Buffer.from(JSON.stringify(event)))
  }
}

module.exports = Lavalink
