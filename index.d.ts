export = Byteball;
export as namespace Byteball;

declare namespace Byteball {
  class Client {
    constructor(nodeAddress?: string);

    broadcast(unit: object): Promise<string>;
    close(): void;

    // Auto-generated methods
    getWitnesses(params: any): any;
    getPeers(params: any): any;
    getJoint(params: any): any;
    getLastMci(params: any): any;
    catchup(params: any): any;
    getHashTree(params: any): any;
    postJoint(params: any): any;
    subscribe(params: any): any;
    getHistory(params: any): any;
    getParentsAndLastBallAndWitnessListUnit(params: any): any;
    getAttestation(params: any): any;
    getAttestations(params: any): any;
    pickDivisibleCoinsForAmount(params: any): any;
    getBots(params: any): any;
    getAssetMetadata(params: any): any;

    compose: {
      message(app, payload, auth): Promise<object>;
      attestation(params: any): Promise<object>;
      data(params: any): Promise<object>;
      dataFeed(params: any): Promise<object>;
      poll(params: any): Promise<object>;
      profile(params: any): Promise<object>;
      text(params: any): Promise<object>;
      vote(params: any): Promise<object>;
      payment(params: any): Promise<object>;
    };

    post: {
      message(app, payload, auth): Promise<string>;
      attestation(params: any): Promise<string>;
      data(params: any): Promise<string>;
      dataFeed(params: any): Promise<string>;
      poll(params: any): Promise<string>;
      profile(params: any): Promise<string>;
      text(params: any): Promise<string>;
      vote(params: any): Promise<string>;
      payment(params: any): Promise<string>;
    };
  }

  namespace utils {
    function generateRandomSeed(): string;
    function isSeedValid(seed: string): boolean;
  }
}
