import dns, { LookupAddress } from "node:dns"
import net from "node:net"

/**
 * Decides which hosts the renderer may make requests to. The rendered page
 * controls every request the browser makes, so this is what stops a request
 * from reaching the cloud metadata service or another service in the cluster.
 */
export interface HostPolicy {
  /** `hostname` as `URL` reports it, so an IPv6 literal keeps its brackets. */
  isAllowed(hostname: string): Promise<boolean>
}

export const allowAllHosts: HostPolicy = {
  isAllowed: () => Promise.resolve(true),
}

export type Lookup = (hostname: string) => Promise<LookupAddress[]>

const defaultLookup: Lookup = (hostname) =>
  dns.promises.lookup(hostname, { all: true })

// Every range that must never be reached from the renderer: loopback,
// private, link-local (which is where cloud metadata lives), multicast and
// the unspecified addresses. `BlockList` applies the IPv4 rules to
// IPv4-mapped IPv6 addresses as well.
const blockedAddresses: net.BlockList = new net.BlockList()

const IPV4_BLOCKED_SUBNETS: [string, number][] = [
  // "this" network
  ["0.0.0.0", 8],
  // private
  ["10.0.0.0", 8],
  // carrier-grade NAT
  ["100.64.0.0", 10],
  // loopback
  ["127.0.0.0", 8],
  // link-local, including the cloud metadata service
  ["169.254.0.0", 16],
  // private
  ["172.16.0.0", 12],
  // private
  ["192.168.0.0", 16],
  // multicast
  ["224.0.0.0", 4],
  // reserved and broadcast
  ["240.0.0.0", 4],
]

const IPV6_BLOCKED_SUBNETS: [string, number][] = [
  // unspecified
  ["::", 128],
  // loopback
  ["::1", 128],
  // NAT64, which can embed any IPv4 address
  ["64:ff9b::", 96],
  // unique local
  ["fc00::", 7],
  // link-local
  ["fe80::", 10],
]

for (const [address, prefix] of IPV4_BLOCKED_SUBNETS) {
  blockedAddresses.addSubnet(address, prefix, "ipv4")
}

for (const [address, prefix] of IPV6_BLOCKED_SUBNETS) {
  blockedAddresses.addSubnet(address, prefix, "ipv6")
}

const isBlocked = (address: string): boolean =>
  blockedAddresses.check(address, net.isIPv6(address) ? "ipv6" : "ipv4")

const stripBrackets = (hostname: string): string =>
  hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname

/**
 * Allows a host only when every address it resolves to is public. An IP
 * literal is checked directly, and a hostname that fails to resolve is
 * treated as blocked.
 */
export const publicHostsOnly = (
  lookup: Lookup = defaultLookup
): HostPolicy => ({
  async isAllowed(hostname: string): Promise<boolean> {
    const host = stripBrackets(hostname)

    if (net.isIP(host) !== 0) {
      return !isBlocked(host)
    }

    let addresses: LookupAddress[]

    try {
      addresses = await lookup(host)
    } catch {
      return false
    }

    return addresses.every(({ address }) => !isBlocked(address))
  },
})
