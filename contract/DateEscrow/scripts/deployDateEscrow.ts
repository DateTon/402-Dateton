import { toNano } from '@ton/core';
import { DateEscrow } from '../build/DateEscrow/DateEscrow_DateEscrow';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const dateEscrow = provider.open(await DateEscrow.fromInit());

    await dateEscrow.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(dateEscrow.address);

    // run methods on `dateEscrow`
}
