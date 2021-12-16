import { ethers } from "hardhat";
import { expect } from "chai";
import { describe, beforeEach, it } from "mocha";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "ethers";
import { duration, latestTimestamp } from "../utils/time";

import {
    TokenDistro,
    UniswapV3RewardToken,
    UniswapV3StakerMock,
    GIV,
    UniswapV3RewardWrapper,
} from "../../typechain-types";
import { IncentiveKeyStruct } from "../../typechain-types/UniswapV3StakerMock";

const { parseEther: toWei } = ethers.utils;
const { days, years } = duration;

let tokenDistro: TokenDistro,
    givToken: GIV,
    gurTokenFactory: ContractFactory,
    uniV3StakerFactory: ContractFactory;
let multisig: SignerWithAddress,
    multisig2: SignerWithAddress,
    recipient1: SignerWithAddress,
    recipient2: SignerWithAddress,
    recipient3: SignerWithAddress,
    recipient4: SignerWithAddress;
let multisigAddress: string,
    multisig2Address: string,
    recipientAddress1: string,
    recipientAddress2: string,
    recipientAddress4: string,
    addrs: Array<SignerWithAddress>;

// TokenDistro parameters:
const amount = toWei("80000000");
const startToCliff = days(180);
const startToEnd = years(5).add(days(10));
const initialPercentage = 500;

describe("UniswapV3RewardToken", () => {
    beforeEach(async () => {
        [
            multisig,
            multisig2,
            recipient1,
            recipient2,
            recipient3,
            recipient4,
            ...addrs
        ] = await ethers.getSigners();

        multisigAddress = await multisig.getAddress();
        multisig2Address = await multisig2.getAddress();
        recipientAddress1 = await recipient1.getAddress();
        recipientAddress2 = await recipient2.getAddress();
        recipientAddress4 = await recipient4.getAddress();

        const givTokenFactory = await ethers.getContractFactory("GIV");
        givToken = (await givTokenFactory.deploy(multisigAddress)) as GIV;
        await givToken.deployed();

        await givToken.mint(multisigAddress, amount);

        const tokenDistroFactory = await ethers.getContractFactory(
            "TokenDistroMock",
        );

        // Start time is offset by 90 days:
        const startTime = (await latestTimestamp()).add(days(90));

        tokenDistro = (await tokenDistroFactory.deploy(
            amount,
            startTime,
            startToCliff,
            startToEnd,
            initialPercentage,
            givToken.address,
            false,
        )) as TokenDistro;

        await givToken.transfer(tokenDistro.address, amount);

        gurTokenFactory = await ethers.getContractFactory(
            "UniswapV3RewardTokenMock",
        );
        uniV3StakerFactory = await ethers.getContractFactory(
            "UniswapV3StakerMock",
        );
    });

    describe("unit tests", () => {
        let uniStaker: UniswapV3StakerMock;
        let token: UniswapV3RewardToken;
        let tokenWrapper;

        beforeEach(async () => {
            uniStaker =
                (await uniV3StakerFactory.deploy()) as UniswapV3StakerMock;

            token = (await gurTokenFactory.deploy(
                tokenDistro.address,
                uniStaker.address,
            )) as UniswapV3RewardToken;

            const tokenWrapperFactory = await ethers.getContractFactory(
                "UniswapV3RewardWrapper",
            );
            tokenWrapper = (await tokenWrapperFactory.deploy(
                token.address,
            )) as UniswapV3RewardWrapper;
        });

        it("should set initial paramerers", async () => {
            expect(await token.tokenDistro()).to.be.eq(tokenDistro.address);
            expect(await token.uniswapV3Staker()).to.be.eq(uniStaker.address);
        });

        describe("approve", () => {
            it("should return true for each account", async () => {
                expect(
                    await tokenWrapper
                        .connect(recipient3)
                        .approveWrapper(recipientAddress2, toWei("999")),
                )
                    .to.emit(tokenWrapper, "BoolResult")
                    .withArgs(true);
            });
        });
    });

    describe("behavior tests", async () => {
        let staker: UniswapV3StakerMock;
        let token: UniswapV3RewardToken;
        let incentiveKey: IncentiveKeyStruct;

        beforeEach(async () => {
            staker = (await uniV3StakerFactory.deploy()) as UniswapV3StakerMock;
            token = (await gurTokenFactory.deploy(
                tokenDistro.address,
                staker.address,
            )) as UniswapV3RewardToken;

            incentiveKey = {
                rewardToken: token.address,
                pool: recipientAddress4, // does not matter because it's mock
                startTime: 0, // does not matter because it's mock
                endTime: 0, // does not matter because it's mock
                refundee: recipientAddress4, // does not matter because it's mock
            };
        });

        it("should allow transferFrom only by staker to itself and tx origin is owner", async () => {
            // check that only multisig can be the caller to the staker
            await expect(
                staker.connect(multisig2).createIncentive(incentiveKey, amount),
            ).to.be.revertedWith(
                "GivethUniswapV3Reward:transferFrom:ONLY_OWNER_CAN_ADD_INCENTIVES",
            );

            // check msg.sender of the reward token must be the stake contracts
            await expect(
                token.transferFrom(multisigAddress, staker.address, amount),
            ).to.be.revertedWith(
                "GivethUniswapV3Reward:transferFrom:ONLY_STAKER",
            );

            expect(await token.balanceOf(staker.address)).to.be.equal(0);
            expect(await token.balanceOf(recipientAddress1)).to.be.equal(0);
            expect(await token.totalSupply()).to.be.equal(0);

            await expect(staker.createIncentive(incentiveKey, amount))
                .to.emit(token, "Transfer")
                .withArgs(ethers.constants.AddressZero, staker.address, amount);

            expect(await token.balanceOf(staker.address)).to.be.equal(amount);
            expect(await token.totalSupply()).to.be.equal(amount);
        });

        it("should allow only staker to transfer token directly", async () => {
            await tokenDistro.grantRole(
                await tokenDistro.DISTRIBUTOR_ROLE(),
                token.address,
            );
            await tokenDistro.assign(token.address, amount);

            await staker.createIncentive(incentiveKey, amount);

            const transferAmount = amount.div(10);
            await expect(
                token.transfer(staker.address, transferAmount),
            ).to.be.revertedWith("GivethUniswapV3Reward:transfer:ONLY_STAKER");

            await expect(staker.claimRewardMock(token.address, transferAmount))
                .to.emit(token, "RewardPaid")
                .withArgs(multisigAddress, transferAmount);

            expect(await token.balanceOf(staker.address)).to.be.equal(
                amount.sub(transferAmount),
            );
            expect(await token.totalSupply()).to.be.equal(
                amount.sub(transferAmount),
            );

            expect(await token.balanceOf(recipientAddress1)).to.be.equal(0);

            await expect(
                staker
                    .connect(multisig2)
                    .claimRewardMock(token.address, transferAmount),
            )
                .to.emit(token, "RewardPaid")
                .withArgs(multisig2Address, transferAmount);
        });

        // Copied from TokenDistro.test.js and refactored to use Transfer instead
        // of Allocate
        it("should Staker be able to transfer the balance", async () => {
            await staker.createIncentive(incentiveKey, amount);

            const amountRecipient1 = amount.div(2);
            const amountRecipient2 = amountRecipient1.div(2);
            const amountRecipient3 = amountRecipient2.div(2);
            const amountRecipient4 = amountRecipient3.div(2);

            await expect(
                staker
                    .connect(recipient1)
                    .claimRewardMock(token.address, amountRecipient1),
            ).to.be.revertedWith(
                "TokenDistro::onlyDistributor: ONLY_DISTRIBUTOR_ROLE",
            );

            await tokenDistro.grantRole(
                await tokenDistro.DISTRIBUTOR_ROLE(),
                token.address,
            );
            await tokenDistro.assign(token.address, amount);

            async function testTransfer(recipientSigner, amountRecipient) {
                const { address: recipientAddress } = recipientSigner;
                await expect(
                    staker
                        .connect(recipientSigner)
                        .claimRewardMock(token.address, amountRecipient),
                )
                    .to.emit(tokenDistro, "Allocate")
                    .withArgs(token.address, recipientAddress, amountRecipient)
                    .to.emit(token, "RewardPaid")
                    .withArgs(recipientAddress, amountRecipient);

                expect(
                    (await tokenDistro.balances(recipientAddress))
                        .allocatedTokens,
                ).to.be.equal(amountRecipient);
            }

            await testTransfer(recipient1, amountRecipient1);
            await testTransfer(recipient2, amountRecipient2);
            await testTransfer(recipient3, amountRecipient3);
            await testTransfer(recipient4, amountRecipient4);
        });

        it("should not transfer more than token distro assigned value", async () => {
            await staker.createIncentive(incentiveKey, amount);

            await tokenDistro.grantRole(
                await tokenDistro.DISTRIBUTOR_ROLE(),
                token.address,
            );
            await tokenDistro.assign(token.address, amount.div(2));

            await expect(
                staker
                    .connect(recipient1)
                    .claimRewardMock(token.address, amount),
            ).to.be.reverted;
        });

        it("should not transfer more than minted value", async () => {
            const transferAmount = amount.div(2);
            await staker.createIncentive(incentiveKey, transferAmount);

            await tokenDistro.grantRole(
                await tokenDistro.DISTRIBUTOR_ROLE(),
                token.address,
            );
            await tokenDistro.assign(token.address, amount);

            await expect(
                staker
                    .connect(recipient1)
                    .claimRewardMock(token.address, amount),
            ).to.be.reverted;
        });
    });
});
