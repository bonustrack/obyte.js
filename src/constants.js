export const DEFAULT_NODE = 'wss://obyte.org/bb';
// versions 1.0-3.0 exist only on the read side (hashing/validating historical
// units and signed messages); composing always produces version 4.0 units
export const VERSION_WITHOUT_TIMESTAMP = '1.0';
export const VERSION_WITHOUT_TIMESTAMP_TESTNET = '1.0t';
// the current protocol version, ocore constants.version
export const VERSION = '4.0';
export const VERSION_TESTNET = '4.0t';
// ocore constants.supported_versions (livenet + testnet variants)
export const SUPPORTED_VERSIONS = ['1.0', '2.0', '3.0', '4.0', '1.0t', '2.0t', '3.0t', '4.0t'];
export const ALT = '1';
export const ALT_TESTNET = '2';
// ocore constants.MAX_RESPONSES_PER_PRIMARY_TRIGGER: validators assume this many
// prepaid AA responses per trigger when the unit doesn't declare max_aa_responses
export const MAX_AA_RESPONSES = 10;
// fixed fee charged for a system_vote_count message, enters the input/output balance
export const SYSTEM_VOTE_COUNT_FEE = 1e9;
export const OFFICIAL_TOKEN_REGISTRY_ADDRESS = 'O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ';
export const HEARTBEAT_TIMEOUT = 10 * 1000;
export const HEARTBEAT_RESPONSE_TIMEOUT = 60 * 1000;
export const HEARTBEAT_PAUSE_TIMEOUT = 2 * HEARTBEAT_TIMEOUT;
