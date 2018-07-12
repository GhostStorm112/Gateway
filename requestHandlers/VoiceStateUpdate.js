const RequestHandler = require('../structures/RequestHandler')
class VoiceStateUpdate extends RequestHandler {
  get name () {
    return 'VoiceStateUpdate'
  }

  get canHandle () {
    return ['VOICE_STATE_UPDATE']
  }

  async handle (event) {
    const queue = await this.lavalink.queues.get(event.guild_id)
    const redis = await this.redis

    await gvsu(redis, queue, event)
    this.lavalink.voiceStateUpdate(event)
    this.bot.voiceStateUpdate(event.shard_id || 0, event)
  }
}

async function gvsu (redis, queue, packet) {
  await queue.player.join(packet.channel_id)
  queue.player.on('error', console.error)

  const players = await redis.storage.get('players', { type: 'arr' })
  let index

  if (Array.isArray(players)) index = players.findIndex(player => player.guild_id === packet.guild_id)
  if (((!players && !index) || index < 0) && packet.channel_id) {
    await redis.storage.upsert('players', [{ guild_id: packet.guild_id, channel_id: packet.channel_id }])
  } else if (players && typeof index !== 'undefined' && index >= 0 && !packet.channel_id) {
    players.splice(index, 1)
    if (players.length === 0) await redis.storage.delete('players')
    else await redis.storage.set('players', players)
    queue.player.removeAllListeners()
  }
}

module.exports = VoiceStateUpdate
