import { normalizeBN } from '@starlay-finance/math-utils'
import { ChainId } from 'src/libs/config'
import {
  walletBalanceProviderContract,
  WalletBalanceProviderInterface,
} from 'src/libs/wallet-balance-provider'
import { AssetSymbol, WalletBalance } from 'src/types/models'
import { SWRResponseWithFallback } from 'src/types/swr'
import { EthereumAddress } from 'src/types/web3'
import { generateSymbolDict } from 'src/utils/assets'
import { BN_ZERO } from 'src/utils/number'
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'
import { useMarketData } from './useMarketData'
import { useStaticRPCProvider } from './useStaticRPCProvider'
import { useWallet } from './useWallet'

const EMPTY_WALLET_BALANCE: WalletBalance = generateSymbolDict(BN_ZERO)

export const useWalletBalance = () => {
  const { account } = useWallet()
  const { data: provider } = useWalletBalanceProvider()
  const { data: marketData } = useMarketData()
  return useSWR(
    () =>
      account &&
      provider &&
      provider.chainId === marketData?.chainId && [
        'wallet-balance',
        provider.chainId,
        account,
      ],
    (_key: string, _chainId: ChainId, account: EthereumAddress) =>
      getWalletBalance(provider!.provider, account, marketData!.assets),
    { fallbackData: EMPTY_WALLET_BALANCE },
  ) as SWRResponseWithFallback<WalletBalance>
}

const useWalletBalanceProvider = () => {
  const { data: provider } = useStaticRPCProvider()
  return useSWRImmutable(
    provider && ['walletbalanceprovider', provider.chainId],
    () => ({
      chainId: provider!.chainId,
      provider: walletBalanceProviderContract(provider!),
    }),
  )
}

const getWalletBalance = async (
  walletBalanceProvider: WalletBalanceProviderInterface,
  account: EthereumAddress,
  assets: {
    symbol: AssetSymbol
    underlyingAsset: EthereumAddress
    decimals: number
  }[],
): Promise<WalletBalance> => {
  const balancesDict =
    await walletBalanceProvider.getBeforeNormalizedWalletBalance(account)
  return assets.reduce((prev, asset) => {
    const balance = balancesDict[asset.underlyingAsset]
    return {
      ...prev,
      [asset.symbol]: balance
        ? normalizeBN(balance.toString(), asset.decimals)
        : BN_ZERO,
    }
  }, {}) as WalletBalance
}
