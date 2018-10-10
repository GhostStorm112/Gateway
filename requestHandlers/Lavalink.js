const RequestHandler = require('../structures/RequestHandler')

class Lavalink extends RequestHandler {
  get name () {
    return 'Lavalink'
  }

  get canHandle () {
    return ['LAVALINK']
  }

  async handle (event) {
    this.log.debug('H-LAVALINK', `Action: ${event.action} running for ${event.guild_id}`)
    const queue = await this.lavalink.queues.get(event.guild_id)

    switch (event.action) {
      case 'RECOVER':
        queue.start()
        break
      case 'PLAY':
        queue.add(event.song)

        if (queue.player.playing === false && queue.player.paused === false) {
          queue.start()
        }
        break
      case 'STOP':
        queue.stop()
        break
      case 'PAUSE':
        queue.player.pause()
        break
      case 'SKIP':
        queue.next()
        break
      case 'RESUME':
        if (queue.player.playing) {
          queue.start()
        } else {
          queue.player.pause(false)
        }
        break
    }
  }
}

module.exports = Lavalink
