"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { createKernelAccount, createKernelAccountClient, getUserOperationGasPrice } from "@zerodev/sdk"
import { createPublicClient, http, formatEther, formatUnits } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { baseSepolia } from "viem/chains"
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants"

const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
  </div>
)

export default function GelatoBenchmark() {
  const [account, setAccount] = useState<any>(null)
  const [accountAddress, setAccountAddress] = useState<string | null>(null)
  const [publicClient, setPublicClient] = useState<any>(null)
  const [metrics, setMetrics] = useState({
    latency: "-",
    l1Gas: "-",
    l2Gas: "-",
    gasPrice: "-",
    txFee: "-",
    hash: "-",
  })
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [isSendingTransaction, setIsSendingTransaction] = useState(false)

  const client = createPublicClient({
    transport: http(),
    chain: baseSepolia,
  })

  // Helper function to format wei to ETH
  const formatWeiToEth = (wei: bigint): string => {
    return formatEther(wei)
  }

  // Helper function to format wei to Gwei
  const formatWeiToGwei = (wei: bigint): string => {
    return formatUnits(wei, 9)
  }

  const createZeroDevKernelAccountForUltraRelay = async () => {
    setIsCreatingAccount(true)
    const startTime = Date.now()
    try {
      const PRIVATE_KEY = generatePrivateKey()
      const signer = privateKeyToAccount(PRIVATE_KEY)
      setPublicClient(client as any)

      const entryPoint = getEntryPoint("0.7")
      const kernelVersion = KERNEL_V3_1
      const ecdsaValidator = await signerToEcdsaValidator(client, {
        signer,
        entryPoint,
        kernelVersion,
      })

      // Create a Kernel account with the validator plugin
      const account = await createKernelAccount(client, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint,
        kernelVersion,
      })

      setAccount(account)
      setAccountAddress(account.address)

      toast({
        title: "ZeroDev Kernel Created",
        description: `Account: ${account.address}`,
      })
    } catch (error) {
      console.error("Error creating ZeroDev Kernel:", error)
      toast({
        title: "Error",
        description: "Failed to create ZeroDev Kernel account. See console for details.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const sendUltraRelayTransactionFromKernelAccount = async () => {
    setIsSendingTransaction(true)
    const startTime = Date.now()
    try {
      if (!account) {
        throw new Error("Kernel Ultra account not initialized")
      }
      if (!publicClient) {
        throw new Error("Public client not initialized")
      }

      const kernelClient = createKernelAccountClient({
        account: account,
        chain: baseSepolia,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ULTRA_RELAY_URL || ""),
        userOperation: {
          estimateFeesPerGas: async ({ bundlerClient }) => {
            return getUserOperationGasPrice(bundlerClient)
          },
        },
      })

      const callData = await kernelClient.account.encodeCalls([
        {
          to: "0x0000000000000000000000000000000000000000",
          value: BigInt(0),
          data: "0x",
        },
      ])

      const userOpHash = await kernelClient.sendUserOperation({
        callData,
        maxFeePerGas: BigInt(0),
        maxPriorityFeePerGas: BigInt(0),
      })

      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })

      const txHash = receipt.receipt.transactionHash

      const txDetails = await publicClient.getTransaction({
        hash: txHash,
      })
      const txReceipt = await publicClient.getTransactionReceipt({
        hash: txHash,
      })

      const block = await publicClient.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      const gasPrice = txDetails.gasPrice || BigInt(0)
      const L2Gas = txReceipt.gasUsed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0)
      const totalTxFee = l1Fee + L2Gas * gasPrice

      setMetrics({
        latency: `${latencySec.toFixed(2)}`,
        l1Gas: l1GasUsed.toString(),
        l2Gas: L2Gas.toString(),
        gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
        txFee: `${formatWeiToEth(totalTxFee)} ETH`,
        hash: txHash,
      })

      toast({
        title: "Transaction Sent",
        description: `Tx Hash: ${txHash}`,
      })
    } catch (error) {
      console.error("Error in Ultra Relay transaction:", error)
      setMetrics((prev) => ({
        ...prev,
        latency: "Failed",
        hash: "Failed",
      }))
      toast({
        title: "Error",
        description: "Failed to send transaction. See console for details.",
        variant: "destructive",
      })
    } finally {
      setIsSendingTransaction(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-8">ZeroDev UltraRelay Sponsored Transaction</h1>
      <Card className="w-full max-w-2xl bg-white text-black">
        <CardHeader>
          <CardTitle className="text-xl">UltraRelay Metrics</CardTitle>
          <p className="text-gray-600">
            Create a ZeroDev Kernel account and send a sponsored transaction using UltraRelay on Base Sepolia.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Latency (s)</TableHead>
                <TableHead>L1 Gas</TableHead>
                <TableHead>L2 Gas</TableHead>
                <TableHead>Gas Price (Gwei)</TableHead>
                <TableHead>Total Tx Fee (ETH)</TableHead>
                <TableHead>Transaction Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{metrics.latency === "-" ? "-" : metrics.latency === "loading" ? <LoadingSpinner /> : metrics.latency}</TableCell>
                <TableCell>{metrics.l1Gas === "-" ? "-" : metrics.l1Gas === "loading" ? <LoadingSpinner /> : metrics.l1Gas}</TableCell>
                <TableCell>{metrics.l2Gas === "-" ? "-" : metrics.l2Gas === "loading" ? <LoadingSpinner /> : metrics.l2Gas}</TableCell>
                <TableCell>{metrics.gasPrice === "-" ? "-" : metrics.gasPrice === "loading" ? <LoadingSpinner /> : metrics.gasPrice}</TableCell>
                <TableCell>{metrics.txFee === "-" ? "-" : metrics.txFee === "loading" ? <LoadingSpinner /> : metrics.txFee}</TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {metrics.hash !== "-" && metrics.hash !== "Failed" ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${metrics.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 truncate"
                    >
                      {metrics.hash}
                    </a>
                  ) : (
                    metrics.hash
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex gap-4 mt-6">
            <Button
              variant="default"
              className="bg-black text-white hover:bg-gray-800"
              onClick={createZeroDevKernelAccountForUltraRelay}
              disabled={isCreatingAccount}
            >
              {isCreatingAccount ? "Creating..." : "Create Account"}
            </Button>
            <Button
              variant="outline"
              className="border-gray-300"
              disabled={!accountAddress || isSendingTransaction}
              onClick={sendUltraRelayTransactionFromKernelAccount}
            >
              {isSendingTransaction ? "Sending..." : "Run Sponsored Transaction"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 