import {
  MongoClient,
  Db,
  Collection,
  Document,
  ChangeStream,
  MongoClientOptions,
  PushOperator,
} from 'mongodb'
import Os from 'os'
import { ActionDoc, PeerDoc } from '../@types/document'

class MongoManager {
  private docConfig: DBConfig
  private host: string
  private logger: WyclifLogger
  private dbConnection!: Db

  private mongoClient!: MongoClient
  private actionsCollection!: Collection<ActionDoc>
  private agentsCollection!: Collection<Document> //TODO: Change this
  private actionsCollectionStream!: ChangeStream<ActionDoc>

  constructor(config: DBConfig, logger: WyclifLogger, argv) {
    this.docConfig = config
    this.logger = logger

    // MongoDB host name
    this.host = argv.peerServer || Os.hostname()
  }

  createConnection(
    checkPeer: CheckPeerFn,
    notifyOfActionDone: (doc: ActionDoc) => void,
    loadInitialUsers: () => void
  ) {
    let url: string = `mongodb://${this.docConfig.host}:${this.docConfig.port}/?replicaSet=rs0`
    this.logger.verbose('Mongo:', this.host, url)
    this.mongoClient = new MongoClient(url)
    this.mongoClient.connect((err, client) => {
      //Connect to mongodb
      if (err) {
        this.logger.error('in Doc DB connect:', err?.stack)
        return
      }
      if (client == undefined) {
        this.logger.error('Client undefined in Doc DB connect')
        return
      }

      this.dbConnection = client.db(this.docConfig.database)

      this.actionsCollection = this.dbConnection.collection('actions')
      //      this.actionsCollectionStream = this.actionsCollection.watch([{$match: { host: null }}])
      this.actionsCollectionStream = this.actionsCollection.watch([
        { $match: { 'fullDocument.host': this.host } },
      ]) //Receive async updates for this host
      this.actionsCollectionStream.on('error', (error) => {
        this.logger.error("Couldn't watch mongo:", this.host, error)
      })
      this.actionsCollectionStream.on('change', (change) => {
        //Handle async notices from doc DB
        const doc = change.fullDocument
        if (doc === undefined) return
        this.logger.debug('Got change:', doc.action, doc.host, doc.data)
        if (doc.action == 'createUser') {
          //Someone asking me to insert a peer into the DB
          checkPeer(doc.data!, (agentData: AgentData) => {
            this.logger.debug(
              'Peer added/OK:',
              agentData.peer_cid,
              'notifying:',
              doc.data?.host
            )
            this.actionsCollection.insertOne(
              {
                action: 'done',
                tag: doc.tag,
                host: doc.data?.host,
                from: this.host,
              },
              () => {}
            )
          })
        } else if (doc.action == 'done') {
          notifyOfActionDone(doc)
        }
        this.actionsCollection.deleteOne({ _id: doc._id }) //Delete signaling record
      })

      this.agentsCollection = this.dbConnection.collection('agents')
      //      this.docAg.createIndex({peer_cid: 1}, {unique: true})		//Should be multicolumn: cid, host
      //      this.docAg.countDocuments((e,r)=>{if (!e) this.worldPop = r})	//Actual people in doc DB
      this.logger.trace('Connected to doc DB')

      loadInitialUsers()
    })
    this.logger.info('Mongo Connection Created')
  }

  isDBClientConnected(): boolean {
    return this.mongoClient != null
  }

  insertAction(command: string, tag: string, host: string, data: AgentData) {
    this.actionsCollection.insertOne(
      { action: command, tag, host, from: this.host, data },
      // @ts-ignore
      undefined,
      (err, _res) => {
        if (err)
          this.logger.error('Sending remote command:', command, 'to:', host)
      }
    )
  }

  updateOneAgent(row: any) {
    row.host = this.host //Mark user as belonging to us

    this.agentsCollection.updateOne(
      { peer_cid: row.peer_cid, host: row.host },
      { $set: row },
      { upsert: true },
      (e, r) => {
        if (e) this.logger.error(e.message)
        else this.logger.trace('Add/update agent:', r)
      }
    )
  }

  //TODO change name
  findOneAndUpdate(agentData: any, maxfoils: number, notifyTryTally) {
    this.agentsCollection.findOneAndUpdate(
      {
        //Look for a trading partner
        peer_cid: {
          $ne: agentData.peer_cid, //Don't find myself
          $nin: agentData.partners, //Or anyone I'm already connected to
        },
        //        host: {$ne: this.host},			//Look only on other hosts
        foils: { $lte: maxfoils }, //Or those with not too many foils already
      },
      {
        $set: { random: Math.random() }, //re-randomize this person
        $inc: { foils: 1 }, //And make it harder to get them again next time
        $push: { partners: agentData.peer_cid }, //Immediately add ourselves to the array to avoid double connecting
      },
      {
        //Sort by
        sort: { foils: 1, random: -1 },
      },
      (e, res) => {
        //Get result of query
        if (e) {
          this.logger.error(e.message)
        } else if (res?.ok) {
          this.logger.verbose(
            '  Best client:',
            res?.value?.std_name,
            res?.value?.host
          )
          notifyTryTally(agentData, res.value)
        } else {
          this.logger.verbose('  No client found in world DB')
        }
      }
    ) //findOneAndUpdate
  }

  deleteManyAgents(processedAgents: PeerCID[]): void {
    this.agentsCollection.deleteMany(
      {
        //Delete any strays left in world db
        host: this.host,
        peer_cid: { $nin: processedAgents },
      },
      (e, r) => {
        if (e) this.logger.error(e.message)
        else this.logger.debug('Delete agents in world:', r)
      }
    )
  }

  updateAgents() {}
}

export default MongoManager
