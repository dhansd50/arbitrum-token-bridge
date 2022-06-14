import { useCopyToClipboard } from 'react-use'
import { ClipboardCopyIcon } from '@heroicons/react/outline'

import { ExternalLink } from '../common/ExternalLink'
import { MergedTransaction } from '../../state/app/state'
import { useNetworksAndSigners } from '../../hooks/useNetworksAndSigners'
import { shortenTxHash } from '../../util/CommonUtils'
import { DepositCardContainer } from './DepositCard'
import { useAppContextDispatch } from '../App/AppContext'

export function DepositCardL1Failure({ tx }: { tx: MergedTransaction }) {
  const { l1 } = useNetworksAndSigners()
  const [, copyToClipboard] = useCopyToClipboard()
  const dispatch = useAppContextDispatch()

  function hide() {
    dispatch({ type: 'set_tx_as_seen', payload: tx.txId })
  }

  return (
    <DepositCardContainer tx={tx}>
      <div className="flex flex-row items-start justify-between">
        <span className="text-4xl font-semibold text-v3-brick-dark">
          Something went wrong
        </span>
        <button
          className="arb-hover text-v3-brick-dark underline"
          onClick={hide}
        >
          Hide
        </button>
      </div>

      <p className="text-2xl font-light text-v3-brick-dark">
        No worries, we got you.
        <br />
        Just paste the following information into a help request:
      </p>

      <button
        className="arb-hover flex max-w-md flex-row items-center justify-between rounded-xl border border-v3-brick-dark px-6 py-4"
        style={{ background: 'rgba(118, 39, 22, 0.2)' }}
        onClick={() => {
          copyToClipboard(
            `L1 transaction: ${l1.network?.explorerUrl}/tx/${tx.txId}`
          )
        }}
      >
        <span className="text-lg text-v3-brick-dark">
          L1 transaction:{' '}
          <span className="text-v3-blue-link">{shortenTxHash(tx.txId)}</span>
        </span>
        <ClipboardCopyIcon className="h-6 w-6 text-v3-brick-dark" />
      </button>

      <ExternalLink
        href="https://support.arbitrum.io/hc/en-us/requests/new"
        className="arb-hover w-max rounded-lg bg-v3-dark px-4 py-3 text-2xl text-white"
      >
        Get Help
      </ExternalLink>
    </DepositCardContainer>
  )
}
