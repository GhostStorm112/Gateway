const EventHandler = require('../structures/EventHandler')
class VoiceStateUpdate extends EventHandler {
  get name () {
    return 'VoiceStateUpdate'
  }

  get canHandle () {
    return ['VOICE_STATE_UPDATE']
  }

  async handle (event) {
    this.log.debug(`E-VSU-${event.shard_id}`, event.t)

    this.lavalink.voiceStateUpdate(event.d)
    if (event.d) { 
      event.d['gateway'] = this.gateway.id
      event.d['t'] = event.t
    }
    this.workerConnector.sendToQueue(event)
  }
}

module.exports = VoiceStateUpdate
