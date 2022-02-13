import * as anchor from '@project-serum/anchor';
import { NextPage } from 'next';
import { ConfirmOptions } from '@solana/web3.js';
import { ProgramAccount } from '@project-serum/anchor';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnchorWallet, useAnchorWallet } from '@solana/wallet-adapter-react';

import IDL from '../../target/idl/counter.json';

const PROGRAM_ID = new anchor.web3.PublicKey(
  '7GrrqwT8xcSSM77QsnE4eTqxkBniNTsyKafTjeV6hiba'
);

const OPTS = {
  preflightCommitment: 'processed',
} as ConfirmOptions;
const endpoint = 'https://api.devnet.solana.com';
const connection = new anchor.web3.Connection(
  endpoint,
  OPTS.preflightCommitment
);

const Home: NextPage = () => {
  const connectedWallet = useAnchorWallet();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [counter, setCounter] = useState<ProgramAccount | null>(null);

  const program = useMemo(() => {
    if (connectedWallet) {
      const provider = new anchor.Provider(
        connection,
        connectedWallet as anchor.Wallet,
        OPTS
      );

      return new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);
    }

    return null;
  }, [connectedWallet]);

  const getCounterForUserWallet = async (
    counterProgram: anchor.Program,
    wallet: AnchorWallet
  ) => {
    const [counter] = await counterProgram.account.counter.all([
      {
        memcmp: {
          offset: 8, // Discriminator.
          bytes: wallet.publicKey.toBase58(),
        },
      },
    ]);

    if (counter) setCounter(counter);
    setIsLoading(false);
  };

  useEffect(() => {
    if (connectedWallet && program) {
      setIsLoading(true);
      getCounterForUserWallet(program, connectedWallet);
    }
  }, [connectedWallet, program]);

  const handleInitializeCounter = useCallback(async () => {
    if (!program || !connectedWallet) return;

    const [counterPubKey, counterBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [connectedWallet.publicKey.toBuffer()],
        program.programId
      );

    await program.rpc.initialize(counterBump, {
      accounts: {
        authority: connectedWallet.publicKey,
        counter: counterPubKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });

    getCounterForUserWallet(program, connectedWallet);
  }, [connectedWallet, program]);

  const handleIncrementCounter = useCallback(async () => {
    if (!program || !connectedWallet || !counter) return;

    await program.rpc.update({
      accounts: {
        authority: connectedWallet.publicKey,
        counter: counter.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });

    getCounterForUserWallet(program, connectedWallet);
  }, [connectedWallet, counter, program]);

  return (
    <div className="flex items-center justify-center">
      <div className="card-bordered card flex min-w-[350px] max-w-md items-center">
        <div className="card-body">
          {counter ? (
            <>
              <h2 className="card-title">
                Current Count: {counter.account.count.toString()}
              </h2>
              <button
                className="btn btn-primary min-w-[143px]"
                onClick={handleIncrementCounter}
              >
                +1
              </button>
            </>
          ) : program && !isLoading ? (
            <>
              <h2 className="card-title">No Counter</h2>
              <button
                className="btn btn-primary"
                onClick={handleInitializeCounter}
              >
                Initialize
              </button>
            </>
          ) : (
            <h2 className="card-title">Loading...</h2>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
