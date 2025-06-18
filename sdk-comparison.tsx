import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function Component() {
  const sdks = [
    {
      name: "Gelato SmartWallet SDK",
      icon: "/gelato-logo.svg",
      iconBg: "bg-red-500",
      isLogo: true,
      latency: "2.21",
      latencyBadge: null,
      l1Gas: "3962",
      l1GasBadge: null,
      l2Gas: "75976",
      l2GasBadge: null,
      chains: "4",
      eip7702: "Yes",
    },
    {
      name: "Alchemy",
      icon: "/alchemy-logo.png", // Changed from emoji to actual logo
      iconBg: "bg-blue-500",
      isLogo: true, // Add flag to indicate this is a logo
      latency: "2.92",
      latencyBadge: "+32% Slower",
      l1Gas: "6420",
      l1GasBadge: "+62% Gas",
      l2Gas: "689468",
      l2GasBadge: "+808% Gas",
      chains: "4",
      eip7702: "No",
    },
    {
      name: "ZeroDev UltraRelay",
      icon: "/zerodev-logo.svg",
      iconBg: "bg-blue-400",
      isLogo: true,
      latency: "2.66",
      latencyBadge: "+20% Slower",
      l1Gas: "5951",
      l1GasBadge: "+50% Gas",
      l2Gas: "230731",
      l2GasBadge: "+204% Gas",
      chains: "2",
      eip7702: "No",
    },
    {
      name: "Pimlico",
      icon: "/pimlico-logo.svg",
      iconBg: "bg-white",
      isLogo: true,
      latency: "2.95",
      latencyBadge: "+33% Slower",
      l1Gas: "8343",
      l1GasBadge: "+111% Gas",
      l2Gas: "355322",
      l2GasBadge: "+368% Gas",
      chains: "1",
      eip7702: "No",
    },
  ]

  const metrics = [
    { label: "Latency (s)", key: "latency", badgeKey: "latencyBadge" },
    { label: "L1 gas", key: "l1Gas", badgeKey: "l1GasBadge" },
    { label: "L2 gas", key: "l2Gas", badgeKey: "l2GasBadge" },
    { label: "# Chains", key: "chains", badgeKey: null },
    { label: "Purpose-built for EIP-7702", key: "eip7702", badgeKey: null },
  ]

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sdks.map((sdk, index) => (
            <Card key={index} className="bg-gray-900 border-gray-700 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-full ${sdk.iconBg} flex items-center justify-center text-white text-xl overflow-hidden`}
                  >
                    {sdk.isLogo ? (
                      <img
                        src={sdk.icon || "/placeholder.svg"}
                        alt={`${sdk.name} logo`}
                        className="w-8 h-8 rounded-sm"
                      />
                    ) : (
                      sdk.icon
                    )}
                  </div>
                </div>
                <h3 className="text-white text-lg font-semibold leading-tight">{sdk.name}</h3>
              </div>

              {/* Metrics */}
              <div className="px-6 pb-6">
                {metrics.map((metric, metricIndex) => (
                  <div
                    key={metricIndex}
                    className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0"
                  >
                    <span className="text-gray-400 text-sm">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{sdk[metric.key as keyof typeof sdk]}</span>
                      {metric.badgeKey && sdk[metric.badgeKey as keyof typeof sdk] && (
                        <Badge
                          variant="secondary"
                          className="bg-orange-900/30 text-orange-400 border-orange-800 text-xs px-2 py-0.5"
                        >
                          {sdk[metric.badgeKey as keyof typeof sdk]}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
