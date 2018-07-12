const RequestHandler = require('../structures/RequestHandler')

class Lavalink extends RequestHandler {
  get name () {
    return 'Lavalink'
  }

  get canHandle () {
    return ['LAVALINK']
  }

  async handle (event) {
    let queue = await this.gateway.lavalink.queues.get(event.guild_id)
    switch (event.action) {
      case 'PLAY':
        await queue.add(event.song)
        if (!queue.player.playing && !queue.player.paused) await queue.start()
        break
      case 'STOP':
        await queue.stop()
        break
      case 'PAUSE':
        await queue.player.pause()
        break
      case 'SKIP':
        await queue.next()
        break
      case 'RESUME':
        await queue.player.pause(false)
        break
      case 'LEAVE':
        await queue.stop()
        this.bot.voiceStateUpdate(event.shard_id || 0, {
          guild_id: event.guild_id,
          channel_id: null,
          self_mute: false,
          self_deaf: false
        })
        break
    }
  }
}

module.exports = Lavalink
