export = Byteball;
export as namespace Byteball;

declare namespace Byteball {
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

  interface Unit {
    unit: string;
    version: string;
    alt: string;
    witness_list_unit: string;
    last_ball_unit: string;
    last_ball: string;
    header_comission: number;
    payload_comission: number;
    main_chain_index: number;
    parent_units: string[];
    authors: Author[];
    messages: Message[];
  }

  interface Joint {
    unit: Unit;
    ball: string;
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

  interface Input {
    type?: 'tranfer' | 'header_comission' | 'witnessing';
    unit?: string;
    message_index?: number;
    output_index?: number;
    from_main_chain_index?: number;
    to_main_chain_index?: number;
  }

  interface Bot {
    id: number;
    name: string;
    pairing_code: string;
    description: string;
  }

  interface JointResponse {
    joint: Joint;
  }

  interface HistoryResponse {
    unstable_mc_joints: Unit[];
    witness_change_and_definition_joints: Unit[];
    joints: Unit[];
    proofchain_balls: ProofchainBall[];
  }

  interface ParentsAndLastBallAndWitnessListUnitResponse {
    parent_units: string[];
    last_stable_mc_ball: string;
    last_stable_mc_ball_unit: string;
    last_stable_mc_ball_mci: string;
    witness_list_unit: string;
  }

  interface PickDivisibleCoinsForAmountResponse {
    inputs_with_proofs: Input[];
    total_amount: number;
  }

  class Client {
    constructor(nodeAddress?: string, testnet?: boolean);

    /**
     * Broadcast a unit.
     * @param unit unit to be broadcast.
     */
    broadcast(unit: Unit): Promise<string>;

    subscribe(callback: (err: null | string, result: any) => void);

    justsaying(subject: string, body: any);

    /**
     * Close underlying WebSocket client.
     */
    close(): void;

    api: {
      heartbeat(callback?: (err: null | string, result: string[] | null) => void): Promise<string[]>;

      getWitnesses(
        callback?: (err: null | string, result: string[] | null) => void,
      ): Promise<string[]>;

      getPeers(callback?: (err: null | string, result: string[] | null) => void): Promise<string[]>;

      getJoint(
        id: string,
        callback?: (err: null | string, joint: JointResponse | null) => void,
      ): Promise<JointResponse>;

      getLastMci(callback?: (err: null | string, result: number | null) => void): Promise<number>;

      postJoint(
        params: { unit: Unit },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<string>;

      getHistory(
        params: { witnesses: string[]; addresses?: string[]; requested_joints?: string[] },
        callback?: (err: null | string, result: string | null) => void,
      ): Promise<HistoryResponse>;

      getParentsAndLastBallAndWitnessListUnit(
        params: { witnesses: string[] },
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

      getBots(callback?: (err: null | string, result: Bot[] | null) => void): Promise<Bot[]>;

      getAssetMetadata(
        asset: string,
        callback?: (err: null | string, result: any | null) => void,
      ): Promise<any>;

      // Those require subscriptions
      catchup(params: any): any;
      getHashTree(params: any): any;
      subscribe(params: any): any;
    };

    compose: {
      message(app, payload, auth): Promise<object>;
      addressDefinitionChange(params: any): Promise<object>;
      attestation(params: any): Promise<object>;
      asset(params: any): Promise<object>;
      assetAttestors(params: any): Promise<object>;
      data(params: any): Promise<object>;
      dataFeed(params: any): Promise<object>;
      definitionTemplate(params: any): Promise<string>;
      poll(params: any): Promise<object>;
      profile(params: any): Promise<object>;
      text(params: any): Promise<object>;
      vote(params: any): Promise<object>;
      payment(params: any): Promise<object>;
    };

    post: {
      message(app, payload, auth): Promise<string>;
      addressDefinitionChange(params: any): Promise<object>;
      attestation(params: any): Promise<string>;
      asset(params: any): Promise<object>;
      assetAttestors(params: any): Promise<object>;
      data(params: any): Promise<string>;
      dataFeed(params: any): Promise<string>;
      definitionTemplate(params: any): Promise<string>;
      poll(params: any): Promise<string>;
      profile(params: any): Promise<string>;
      text(params: any): Promise<string>;
      vote(params: any): Promise<string>;
      payment(params: any): Promise<string>;
    };
  }
}
