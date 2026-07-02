export const DEFAULT_NODE = 'wss://obyte.org/bb';
export const VERSION = '3.0';
export const VERSION_TESTNET = '3.0t';
export const VERSION_WITHOUT_KEY_SIZES = '2.0';
export const VERSION_WITHOUT_TIMESTAMP = '1.0';
export const VERSION_WITHOUT_TIMESTAMP_TESTNET = '1.0t';
export const VERSION4 = '4.0';
export const VERSION4_TESTNET = '4.0t';
// ocore constants.supported_versions (livenet + testnet variants)
export const SUPPORTED_VERSIONS = ['1.0', '2.0', '3.0', '4.0', '1.0t', '2.0t', '3.0t', '4.0t'];
export const ALT = '1';
export const ALT_TESTNET = '2';
export const KEY_SIZE_UPGRADE_MCI = 5530000;
export const V4_UPGRADE_MCI = 10968000;
export const V4_UPGRADE_MCI_TESTNET = 3522600;
// ocore constants.MAX_RESPONSES_PER_PRIMARY_TRIGGER: validators assume this many
// prepaid AA responses per trigger when the unit doesn't declare max_aa_responses
export const MAX_AA_RESPONSES = 10;
// fixed fee charged for a system_vote_count message, enters the input/output balance
export const SYSTEM_VOTE_COUNT_FEE = 1e9;
export const HEARTBEAT_TIMEOUT = 10 * 1000;
export const HEARTBEAT_RESPONSE_TIMEOUT = 60 * 1000;
export const HEARTBEAT_PAUSE_TIMEOUT = 2 * HEARTBEAT_TIMEOUT;
