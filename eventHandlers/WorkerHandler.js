const EventHandler = require('../structures/EventHandler')

class WorkerHandler extends EventHandler {
  get name () {
    return 'WorkerHandler'
  }

  get canHandle () {
    return ['CHANNEL_CREATE', 'CHANNEL_DELETE', 'CHANNEL_PINS_UPDATE', 'CHANNEL_UPDATE', 'GUILD_BAN_ADD',
      'GUILD_BAN_REMOVE', 'GUILD_CREATE', 'GUILD_DELETE', 'GUILD_EMOJIS_UPDATE', 'GUILD_MEMBERS_CHUNK',
      'GUILD_MEMBER_ADD', 'GUILD_MEMBER_REMOVE', 'GUILD_MEMBER_UPDATE', 'GUILD_ROLE_CREATE', 'GUILD_ROLE_DELETE',
      'GUILD_ROLE_UPDATE', 'GUILD_UPDATE', 'USER_UPDATE', 'MESSAGE_CREATE']
  }

  async handle (event) {
    this.log.debug(`E-${event.shard_id}`, event.t)

    if (event.d) { 
      event.d['gateway'] = this.gateway.id
      event.d['t'] = event.t
    }
    this.workerConnector.sendToQueue(event)
  }
}

module.exports = WorkerHandler
