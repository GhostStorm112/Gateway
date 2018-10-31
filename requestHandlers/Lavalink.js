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
        if (queue.player.paused === false) {
          this.log.debug('RECOVER', 'Running start')
          queue.start()          
        }
        this.log.debug('RECOVER', 'Queue paused')
        break
      case 'PLAY':
        await queue.add(event.track)
        if(queue.player.playing === false && queue.player.paused === false) {
          await queue.start()
        }
        this.log.debug('PLAY', 'Running start')
        break
      case 'STOP':
        queue.stop()
        break
      case 'PAUSE':
        queue.player.pause(true)
        break
      case 'SKIP':
        queue.next()
        break
      case 'RESUME':
        queue.player.pause(false)
        break
    }
  }
}

module.exports = Lavalink
