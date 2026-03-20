import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { DateEscrow } from '../build/DateEscrow/DateEscrow_DateEscrow';
import '@ton/test-utils';

describe('DateEscrow', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let dateEscrow: SandboxContract<DateEscrow>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        dateEscrow = blockchain.openContract(await DateEscrow.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await dateEscrow.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: dateEscrow.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and dateEscrow are ready to use
    });
});
