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
    console.log(queue.player.paused)
    console.log(queue.player.playing)
    switch (event.action) {
      case 'RECOVER':
        queue.start()
        break
      case 'PLAY':
        await queue.add(event.song)

        if (queue.player.playing === false && queue.player.paused === false) {
          await queue.start()
        }
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
        if (queue.player.playing) {
          await queue.start()
        } else {
          await queue.player.pause(false)
        }
        break
    }
  }
}

module.exports = Lavalink
