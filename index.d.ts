export = Obyte;
export as namespace Obyte;

declare namespace Obyte {
  interface Options {
    testnet?: boolean;
    wif?: string;
    address?: string;
    definition?: any[];
    path?: string;
    privateKey?: any;
    reconnect?: boolean;
    closeIfError?: boolean;
    /**
     * Max prepaid AA responses per primary AA trigger, used to quote tps_fee
     * (default 10, ocore MAX_RESPONSES_PER_PRIMARY_TRIGGER). When set explicitly
     * and the outputs trigger AAs, it is also written into the unit.
     */
    max_aa_responses?: number;
  }

  /**
   * The browser-compatible surface shared by the native `WebSocket` (browser)
   * and the `ws` package (Node.js) — the two implementations used underneath.
   */
  interface WSClientSocket {
    readonly readyState: number;
    send(data: string): void;
    close(): void;
    addEventListener(
      type: 'open' | 'message' | 'close' | 'error',
      listener: (event: any) => void,
    ): void;
    removeEventListener(
      type: 'open' | 'message' | 'close' | 'error',
      listener: (event: any) => void,
    ): void;
  }

  /** Low-level WebSocket client wrapper, exposed on `Client.client`. */
  interface WSClient {
    address: string;
    /** True while the connection is established. */
    open: boolean;
    /** Set to false before `close()` to shut a reconnecting client down permanently. */
    reconnect: boolean;
    closeIfError: boolean;
    /** Underlying socket; null while a reconnection is pending. */
    ws: WSClientSocket | null;
    connect(): void;
    onConnect(callback: () => void): void;
    onError(callback: (err: any) => void): void;
    subscribe(callback: (err: null | string, result: any) => void): void;
    request(command: string, params: any, callback: (err: any, result: any) => void): void;
    send(message: any, onError?: () => void): void;
    respond(command: string, tag: string, message?: any): void;
    error(command: string, tag: string, message: any): void;
    justsaying(subject: string, body?: any): void;
    close(): void;
  }

  interface Author {
    address: string;
    authentifiers: object;
    definition?: any[];
  }

  interface Message {
    app: string;
    payload_hash: string;
    payload_location: 'inline' | 'uri' | 'none';
    payload?: any;
  }

  /**
   * Field set per ocore validation.js: everything except unit/version/alt/authors/messages
   * is conditional (e.g. the genesis unit has no parent_units/last_ball, old units have
   * `witnesses` instead of `witness_list_unit`).
   */
  interface Unit {
    unit: string;
    version: string;
    alt: string;
    witness_list_unit?: string;
    witnesses?: string[];
    earned_headers_commission_recipients?: Array<{ address: string; earned_headers_commission_share: number }>;
    last_ball_unit?: string;
    last_ball?: string;
    timestamp?: number;
    headers_commission: number;
    payload_commission: number;
    oversize_fee?: number;
    tps_fee?: number;
    max_aa_responses?: number;
    main_chain_index?: number;
    parent_units?: string[];
    authors: Author[];
    messages: Message[];
  }

  interface Joint {
    unit: Unit;
    /** Absent on units that are not deep enough into the stable chain yet. */
    ball?: string;
    skiplist_units?: string[];
  }

  interface ProofchainBall {
    unit: string;
    ball: string;
    parent_balls: string[];
  }

  interface Attestation {
    unit: string;
    attestor_address: string;
    profile: object;
  }

  /** Absent `type` means a transfer input (ocore validation.js: type || "transfer"). */
  interface Input {
    type?: 'issue' | 'headers_commission' | 'witnessing';
    unit?: string;
    message_index?: number;
    output_index?: number;
    from_main_chain_index?: number;
    to_main_chain_index?: number;
    amount?: number;
    serial_number?: number;
    address?: string;
  }

  interface InputWithProof {
    input: Input;
    spend_proof?: object;
  }

  interface Bot {
    id: number;
    name: string;
    pairing_code: string;
    description: string;
  }

  interface TempPubkey {
    temp_pubkey: string;
    pubkey: string;
    signature: string;
  }

  interface EncryptedPackage {
    encrypted_message: string;
    iv: string;
    authtag: string;
    dh: Dh;
  }

  interface Dh {
    sender_ephemeral_pubkey: string;
    recipient_ephemeral_pubkey?: string;
  }

  /** `joint_not_found` (with the requested unit hash) comes instead of `joint` — as a success response. */
  interface JointResponse {
    joint?: Joint;
    joint_not_found?: string;
  }

  interface AaResponse {
    mci: number;
    trigger_address: string;
    aa_address: string;
    trigger_unit: string;
    bounced: 0 | 1;
    response_unit: string | null;
    response: any;
    timestamp: number;
    /** Attached by the hub when response_unit is known (ocore light.js enrichAAResponses). */
    objResponseUnit?: Unit;
  }

  interface HistoryResponse {
    unstable_mc_joints?: Joint[];
    witness_change_and_definition_joints?: Joint[];
    joints?: Joint[];
    proofchain_balls?: ProofchainBall[];
    aa_responses?: AaResponse[];
  }

  interface LastStableUnitProps {
    unit: string;
    main_chain_index: number;
    timestamp: number;
  }

  /** One vote-count result for a system var; the entry with the highest vote_count_mci below the current mci applies. */
  interface SystemVarValue {
    vote_count_mci: number;
    value: number | string[];
    is_emergency?: number;
  }

  interface SystemVars {
    op_list: SystemVarValue[];
    threshold_size: SystemVarValue[];
    base_tps_fee: SystemVarValue[];
    tps_interval: SystemVarValue[];
    tps_fee_multiplier: SystemVarValue[];
  }

  interface SystemVarVote {
    address: string;
    unit: string;
    timestamp: number;
    value: number | string[];
    is_stable: 0 | 1;
  }

  interface SystemVarVotesResponse {
    votes: {
      op_list: SystemVarVote[];
      threshold_size: SystemVarVote[];
      base_tps_fee: SystemVarVote[];
      tps_interval: SystemVarVote[];
      tps_fee_multiplier: SystemVarVote[];
    };
    balances: { [address: string]: number };
  }

  interface ParentsAndLastBallAndWitnessListUnitResponse {
    timestamp: number;
    parent_units: string[];
    last_stable_mc_ball: string;
    last_stable_mc_ball_unit: string;
    last_stable_mc_ball_mci: number;
    witness_list_unit?: string;
    tps_fee?: number;
    count_primary_aa_triggers?: number;
  }

  interface PickDivisibleCoinsForAmountResponse {
    inputs_with_proofs: InputWithProof[];
    total_amount: number;
  }

  interface AssetBalance {
    stable: number;
    pending: number;
    stable_outputs_count: number;
    pending_outputs_count: number;
    total: number;
  }

  interface Balances {
    [address: string]: { base: AssetBalance } & { [asset: string]: AssetBalance };
  }

  class Client {
    constructor(nodeAddress?: string, clientOptions?: Options);

    /** Low-level WebSocket client (heartbeats, raw requests, the underlying socket). */
    client: WSClient;

    /**
     * Broadcast a unit.
     * @param unit unit to be broadcast.
     */
    broadcast(unit: Unit): Promise<string>;

    subscribe(callback: (err: null | string, result: any) => void): void;

    justsaying(subject: string, body?: any): void;

    onConnect(callback: () => void): void;

    onError(callback: (err: any) => void): void;

    /**
     * Close underlying WebSocket client.
     */
    close(): void;

    api: {
      /** Resolves with null (plain ack) or 'sleep' if the peer's timers are suspended. */
      heartbeat(
        callback?: (err: null | string, result: 'sleep' | null) => void,
      ): Promise<'sleep' | null>;

      getWitnesses(
        callback?: (err: null | string, result: string[] | null) => void,
      ): Promise<string[]>;

      getPeers(callback?: (err: null | string, result: string[] | null) => void): Promise<string[]>;

      getJoint(
        id: string,
        callback?: (err: null | string, joint: JointResponse | null) => void,
      ): Promise<JointResponse>;

      getLastMci(callback?: (err: null | string, result: number | null) => void): Promise<number>;

      getLastStableUnitProps(
        callback?: (err: null | string, result: LastStableUnitProps | null) => void,
      ): Promise<LastStableUnitProps>;

      /** v4+ governance-voted system vars; each entry is a history of votes, newest applies. */
      getSystemVars(
        callback?: (err: null | string, result: SystemVars | null) => void,
      ): Promise<SystemVars>;

      getSystemVarVotes(
        callback?: (err: null | string, result: SystemVarVotesResponse | null) => void,
      ): Promise<SystemVarVotesResponse>;

      postJoint(
        params: { unit: Unit },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getHistory(
        params: {
          witnesses: string[];
          addresses?: string[];
          requested_joints?: string[];
          known_stable_units?: string[];
          min_mci?: number;
        },
        callback?: (err: null | string, result: HistoryResponse | null) => void,
      ): Promise<HistoryResponse>;

      /** Link proofs for units sorted in reverse chronological order. */
      getLinkProofs(
        units: string[],
        callback?: (err: null | string, result: Joint[] | null) => void,
      ): Promise<Joint[]>;

      getParentsAndLastBallAndWitnessListUnit(
        params: {
          witnesses: string[];
          /** Required by v4+ hubs to compute tps_fee. */
          from_addresses?: string[];
          output_addresses?: string[];
          max_aa_responses?: number;
        },
        callback?: (
          err: null | string,
          result: ParentsAndLastBallAndWitnessListUnitResponse | null,
        ) => void,
      ): Promise<ParentsAndLastBallAndWitnessListUnitResponse>;

      getAttestation(
        params: {
          attestor_address: string;
          field: string;
          value: string;
        },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getAttestations(
        params: { address: string },
        callback?: (err: null | string, result: Attestation[] | null) => void,
      ): Promise<Attestation[]>;

      pickDivisibleCoinsForAmount(
        params: {
          addresses: string[];
          last_ball_mci: number;
          amount: number;
          asset?: string;
          spend_unconfirmed?: 'all' | 'own' | 'none';
        },
        callback?: (err: null | string, result: PickDivisibleCoinsForAmountResponse | null) => void,
      ): Promise<PickDivisibleCoinsForAmountResponse>;

      getDefinition(
        address: string,
        callback?: (err: null | string, result: any[] | null) => void,
      ): Promise<any[]>;

      getDefinitionForAddress(
        params: {
          address: string;
        },
        callback?: (err: null | string, result: object) => void,
      ): Promise<object>;

      getDefinitionChash(
        params: {
          address: string;
          max_mci?: number;
        },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getBalances(
        addresses: string[],
        callback?: (err: null | string, result: Balances | null) => void,
      ): Promise<Balances>;

      getProfileUnits(
        addresses: string[],
        callback?: (err: null | string, result: string[] | any[]) => void,
      ): Promise<string[]>;

      /** Resolves with an array of simulated AA responses. */
      dryRunAa(
        params: {
          address: string;
          trigger: any;
        },
        callback?: (err: null | string, result: any[] | null) => void,
      ): Promise<any[]>;

      getAaStateVars(
        params: {
          address: string;
          var_prefix?: string;
          var_prefix_from?: string;
          var_prefix_to?: string;
          limit?: number;
        },
        callback?: (err: null | string, result: object | null) => void,
      ): Promise<object>;

      /** Balances held by an AA, keyed by asset ('base' for bytes). */
      getAaBalances(
        params: { address: string },
        callback?: (
          err: null | string,
          result: { balances: { [asset: string]: number } } | null,
        ) => void,
      ): Promise<{ balances: { [asset: string]: number } }>;

      getAasByBaseAas(
        params: {
          base_aa?: string;
          base_aas?: string[];
          params?: object;
        },
        callback?: (
          err: null | string,
          result: Array<{ address: string; definition: any[]; unit: string; creation_date: string }> | null,
        ) => void,
      ): Promise<Array<{ address: string; definition: any[]; unit: string; creation_date: string }>>;

      getAaResponses(
        params: {
          aa?: string;
          aas?: string[];
          min_mci?: number;
          max_mci?: number;
          order?: 'ASC' | 'DESC';
        },
        callback?: (err: null | string, result: AaResponse[] | null) => void,
      ): Promise<AaResponse[]>;

      getAaResponseChain(
        params: {
          trigger_unit: string;
        },
        callback?: (err: null | string, result: AaResponse[] | null) => void,
      ): Promise<AaResponse[]>;

      executeGetter(
        params: {
          address: string;
          getter: string;
          args?: any[];
        },
        callback?: (err: null | string, result: { result: any } | null) => void,
      ): Promise<{ result: any }>;

      /** Resolves with the data feed value itself (or the unit hash when what: 'unit'). */
      getDataFeed(
        params: {
          oracles: string[];
          feed_name: string;
          feed_value?: string | number | boolean;
          min_mci?: number;
          max_mci?: number;
          ifseveral?: 'abort' | 'last';
          what?: 'unit' | 'value';
          type?: 'string' | 'auto';
          ifnone?: string | number | boolean;
        },
        callback?: (err: null | string, result: string | number | null) => void,
      ): Promise<string | number>;

      getBots(callback?: (err: null | string, result: Bot[] | null) => void): Promise<Bot[]>;

      getTempPubkey(
        permanentPubkey: string,
        callback?: (err: null | string, result: TempPubkey | null) => void,
      ): Promise<TempPubkey>;

      /** Resolves with "updated". */
      tempPubkey(
        params: {
          temp_pubkey: string;
          pubkey: string;
          signature: string;
        },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      deliver(
        params: {
          encrypted_package: EncryptedPackage;
          to: string;
          pubkey: string;
          signature: string;
        },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getAssetMetadata(
        asset: string,
        callback?: (
          err: null | string,
          result: { metadata_unit: string; registry_address: string; suffix: string | null } | null,
        ) => void,
      ): Promise<{ metadata_unit: string; registry_address: string; suffix: string | null }>;

      /** Fiat exchange rates kept by the hub (e.g. GBYTE_USD, BTC_USD). */
      getExchangeRates(
        callback?: (err: null | string, result: { [pair: string]: number } | null) => void,
      ): Promise<{ [pair: string]: number }>;

      /** Resolves with "ok"; requires a device login on this connection. */
      enableNotification(
        registrationId: any,
        callback?: (err: null | string, result: 'ok' | null) => void,
      ): Promise<'ok'>;

      /** Resolves with "ok"; requires a device login on this connection. */
      disableNotification(
        registrationId: any,
        callback?: (err: null | string, result: 'ok' | null) => void,
      ): Promise<'ok'>;

      getArbstoreUrl(
        arbiterAddress: string,
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getArbstoreAddress(
        arbiterAddress: string,
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getArbstoreUrlByAddress(
        arbstoreAddress: string,
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      /** With a single argument (or a null registry) the official token registry is used. */
      getSymbolByAsset(asset: string | null): Promise<string>;
      getSymbolByAsset(tokenRegistryAddress: string | null, asset: string | null): Promise<string>;

      /** With a single argument (or a null registry) the official token registry is used. */
      getAssetBySymbol(symbol: string): Promise<string | null>;
      getAssetBySymbol(tokenRegistryAddress: string | null, symbol: string): Promise<string | null>;

      /** With a single argument (or a null registry) the official token registry is used. */
      getDecimalsBySymbolOrAsset(symbolOrAsset: string): Promise<number>;
      getDecimalsBySymbolOrAsset(
        tokenRegistryAddress: string | null,
        symbolOrAsset: string,
      ): Promise<number>;
      
      getOfficialTokenRegistryAddress(): string;
      
      // Those require subscriptions
      catchup(params: any): any;
      getHashTree(params: any): any;
      subscribe(params: any): any;
    };

    compose: {
      message(app, payload, options?: Options): Promise<object>;
      addressDefinitionChange(params: any): Promise<object>;
      attestation(params: any): Promise<object>;
      asset(params: any): Promise<object>;
      assetAttestors(params: any): Promise<object>;
      data(params: any): Promise<object>;
      dataFeed(params: any): Promise<object>;
      definition(params: any): Promise<string>;
      definitionTemplate(params: any): Promise<string>;
      poll(params: any): Promise<object>;
      profile(params: any): Promise<object>;
      text(params: any): Promise<object>;
      vote(params: any): Promise<object>;
      payment(params: any): Promise<object>;
      /** v4+ governance vote: { subject, value }. */
      systemVote(params: any): Promise<object>;
      /** v4+ vote count trigger: payload is the subject string; costs a fixed 1e9 bytes fee. */
      systemVoteCount(params: any): Promise<object>;
    };

    post: {
      message(app, payload, options?: Options): Promise<string>;
      addressDefinitionChange(params: any): Promise<object>;
      attestation(params: any): Promise<string>;
      asset(params: any): Promise<object>;
      assetAttestors(params: any): Promise<object>;
      data(params: any): Promise<string>;
      dataFeed(params: any): Promise<string>;
      definition(params: any): Promise<string>;
      definitionTemplate(params: any): Promise<string>;
      poll(params: any): Promise<string>;
      profile(params: any): Promise<string>;
      text(params: any): Promise<string>;
      vote(params: any): Promise<string>;
      payment(params: any): Promise<string>;
      /** v4+ governance vote: { subject, value }. */
      systemVote(params: any): Promise<string>;
      /** v4+ vote count trigger: payload is the subject string; costs a fixed 1e9 bytes fee. */
      systemVoteCount(params: any): Promise<string>;
    };
  }

  interface WIFReturn {
    readonly version: number;
    readonly privateKey: Uint8Array;
    readonly compressed: boolean;
  }

  interface IObjUnit {
    version: string;
    signed_message: any;
    authors: Array<Author>
  }

  module utils {
    function isValidAddress(address: string): boolean;
    function getChash160(object: object | Array<any>): string;
    function toWif(privateKey: Uint8Array, testnet: boolean): string;
    function fromWif(string: string, testnet: boolean): WIFReturn;
    function signMessage(message: any, options: object): IObjUnit;
    function validateSignedMessage(objSignedMessage: object, address: string | null, message: any | null): boolean;
  }
}
