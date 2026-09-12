import { LookupAddress } from "node:dns"
import { allowAllHosts, publicHostsOnly } from "./HostPolicy"

// `publicHostsOnly` is given a fake resolver so that these tests never touch
// DNS. Every hostname resolves to whatever the table says, or fails to
// resolve when it is missing.
const resolver =
  (table: Record<string, string[]>) =>
  (hostname: string): Promise<LookupAddress[]> => {
    const addresses = table[hostname]

    if (addresses === undefined) {
      return Promise.reject(new Error(`getaddrinfo ENOTFOUND ${hostname}`))
    }

    return Promise.resolve(
      addresses.map((address) => ({
        address,
        family: address.includes(":") ? 6 : 4,
      }))
    )
  }

describe("HostPolicy", () => {
  describe("allowAllHosts", () => {
    test.each(["example.com", "127.0.0.1", "localhost", "[::1]"])(
      "allows %s",
      async (hostname) => {
        await expect(allowAllHosts.isAllowed(hostname)).resolves.toBe(true)
      }
    )
  })

  describe("publicHostsOnly", () => {
    const policy = publicHostsOnly(
      resolver({
        "example.com": ["93.184.216.34"],
        "dual-stack.example.com": [
          "93.184.216.34",
          "2606:2800:220:1:248:1893:25c8:1946",
        ],
        "round-robin.example.com": ["93.184.216.34", "10.0.0.5"],
        "internal.example.com": ["10.0.0.5"],
        "metadata.example.com": ["169.254.169.254"],
        localhost: ["127.0.0.1", "::1"],
      })
    )

    test("allows a hostname that resolves to a public address", async () => {
      await expect(policy.isAllowed("example.com")).resolves.toBe(true)
    })

    test("allows a hostname whose every address is public", async () => {
      await expect(policy.isAllowed("dual-stack.example.com")).resolves.toBe(
        true
      )
    })

    test("rejects a hostname when any of its addresses is private", async () => {
      await expect(policy.isAllowed("round-robin.example.com")).resolves.toBe(
        false
      )
    })

    test.each([
      ["internal.example.com", "a private address"],
      ["metadata.example.com", "the link-local metadata address"],
      ["localhost", "loopback"],
    ])("rejects %s, which resolves to %s", async (hostname) => {
      await expect(policy.isAllowed(hostname)).resolves.toBe(false)
    })

    test("rejects a hostname that does not resolve", async () => {
      await expect(policy.isAllowed("missing.example.com")).resolves.toBe(false)
    })

    test.each([
      ["93.184.216.34", "a public IPv4 address"],
      ["[2606:2800:220:1:248:1893:25c8:1946]", "a public IPv6 address"],
    ])("allows %s, %s, without resolving it", async (hostname) => {
      const lookup = jest.fn()

      await expect(publicHostsOnly(lookup).isAllowed(hostname)).resolves.toBe(
        true
      )
      expect(lookup).not.toHaveBeenCalled()
    })

    test.each([
      ["0.0.0.0", "the unspecified IPv4 address"],
      ["127.0.0.1", "IPv4 loopback"],
      ["127.255.255.254", "the end of the IPv4 loopback range"],
      ["10.0.0.5", "a 10/8 private address"],
      ["172.16.0.1", "a 172.16/12 private address"],
      ["172.31.255.255", "the end of the 172.16/12 range"],
      ["192.168.1.1", "a 192.168/16 private address"],
      ["100.64.0.1", "a carrier-grade NAT address"],
      ["169.254.169.254", "the cloud metadata address"],
      ["224.0.0.1", "a multicast address"],
      ["255.255.255.255", "the broadcast address"],
      ["[::]", "the unspecified IPv6 address"],
      ["[::1]", "IPv6 loopback"],
      ["[fc00::1]", "a unique local IPv6 address"],
      ["[fd12:3456::1]", "another unique local IPv6 address"],
      ["[fe80::1]", "a link-local IPv6 address"],
      ["[::ffff:127.0.0.1]", "IPv4-mapped loopback"],
      ["[::ffff:10.0.0.5]", "an IPv4-mapped private address"],
      ["[64:ff9b::a00:5]", "a NAT64 translation of a private address"],
    ])("rejects the literal %s, %s", async (hostname) => {
      const lookup = jest.fn()

      await expect(publicHostsOnly(lookup).isAllowed(hostname)).resolves.toBe(
        false
      )
      expect(lookup).not.toHaveBeenCalled()
    })

    test("rejects a public address outside the 172.16/12 range only when private", async () => {
      await expect(
        publicHostsOnly(jest.fn()).isAllowed("172.32.0.1")
      ).resolves.toBe(true)
    })

    test("resolves with the system resolver by default", async () => {
      await expect(publicHostsOnly().isAllowed("localhost")).resolves.toBe(
        false
      )
    })
  })
})
