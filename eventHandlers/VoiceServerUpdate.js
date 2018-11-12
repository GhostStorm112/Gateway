const EventHandler = require('../structures/EventHandler')
class VoiceServerUpdate extends EventHandler {
  get name () {
    return 'VoiceServerUpdate'
  }

  get canHandle () {
    return ['VOICE_SERVER_UPDATE']
  }

  async handle (event) {
    this.log.debug(`E-VSERU-${event.shard_id}`, event.t)
    this.lavalink.voiceServerUpdate(event.d)

  }
}

module.exports = VoiceServerUpdate
