/**
 * Checks if an error is caused by MetaMask's stale block cache
 * (happens when Hardhat node restarts but MetaMask still sends old block numbers)
 *
 * ethers.js v6 wraps RPC errors deeply — the raw "invalid block tag" message
 * can live at error.message, error.error.message, error.info.error.message,
 * error.shortMessage, or nested even further. We check all known paths and
 * fall back to JSON.stringify as a last resort.
 */
export function isStaleBlockError(error) {
  const needle = 'invalid block tag';
  // Check top-level message (ethers serializes info into it)
  if (error?.message?.includes(needle)) return true;
  // Check nested error.error.message (Object.assign from ethers info)
  if (error?.error?.message?.includes(needle)) return true;
  // Check error.info.error.message (ethers v6 CALL_EXCEPTION structure)
  if (error?.info?.error?.message?.includes(needle)) return true;
  // Check shortMessage (ethers v6)
  if (error?.shortMessage?.includes(needle)) return true;
  // Check stringified error as last resort
  try {
    if (JSON.stringify(error).includes(needle)) return true;
  } catch {}
  return false;
}

export const STALE_BLOCK_MESSAGE =
  'MetaMask has a stale cache. Force-quit your browser (not just close the tab) and reopen it to fix this.';
