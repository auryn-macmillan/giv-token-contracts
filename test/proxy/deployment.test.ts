import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { beforeEach, describe, it } from "mocha";
import { duration } from "../utils/time";

const { deployProxy, upgradeProxy } = upgrades;
const { parseEther: toWei, formatBytes32String: toBytes32 } = ethers.utils;
const { days, years } = duration;

const upgradeText = "OK";
const testAddress = "0x000000000000000000000000000000000000dEaD";
const testVal = toBytes32("0xdead");

const totalAmount = toWei("200000");
const startTime = BigNumber.from(0);
const startToCliff = days(180);
const startToEnd = years(5);
const initialPercentage = 500;

const initialAmount = totalAmount.mul(initialPercentage).div(10000);
const lockedAmount = totalAmount.sub(initialAmount);
const token = testAddress;
const cancellable = false;

const tokenDistro = testAddress;
const merkleRoot = testVal;

const tokenName = "Giveth Uniswap V3 Reward Token";
const tokenSymbol = "GUR";
const decimals = 18;
const uniswapV3Staker = testAddress;
const totalSupply = BigNumber.from(0);

const tokenManager = testAddress;
const rewardDistribution = testAddress;
const lastUpdateTime = BigNumber.from(0);
const periodFinish = startToEnd;
const rewardRate = BigNumber.from(0);
const rewardPerTokenStored = BigNumber.from(0);

const contractsToTest = [
    {
        name: "TokenDistro",
        initParams: [
            totalAmount,
            startTime,
            startToCliff,
            startToEnd,
            initialPercentage,
            token,
            cancellable,
        ],
        upgradeCheckParams: [
            totalAmount,
            startTime,
            startToCliff,
            startToEnd,
            initialAmount,
            lockedAmount,
            token,
            cancellable,
        ],
    },
    {
        name: "MerkleDistro",
        initParams: [tokenDistro, merkleRoot],
        upgradeCheckParams: [tokenDistro, merkleRoot],
    },
    {
        name: "UniswapV3RewardToken",
        initParams: [
            testAddress, // tokenDistro
            testAddress, // uniswapV3Staker
        ],
        upgradeCheckParams: [
            tokenName,
            tokenSymbol,
            decimals,
            tokenDistro,
            uniswapV3Staker,
            totalSupply,
        ],
    },
    {
        name: "GardenUnipoolTokenDistributor",
        initParams: [
            testAddress, // tokenDistro
            years(5), // startToEnd
            testAddress, // tokenManager
        ],
        upgradeCheckParams: [
            BigNumber.from(0), // totalSupply
            testAddress, // tokenDistro
            years(5), // startToEnd
            testAddress, // rewardDistribution
            BigNumber.from(0), // periodFinish
            BigNumber.from(0), // rewardRate
            BigNumber.from(0), // lastUpdateTime,
            BigNumber.from(0), // rewardPerTokenStored,
        ],
        beforeUpgrade: async (contractInstance: Contract) => {
            await contractInstance.setRewardDistribution(testAddress);
        },
    },
];

describe("Proxy upgradeability tests", () => {
    contractsToTest.map((contract) => {
        const { name, initParams, upgradeCheckParams, beforeUpgrade } =
            contract;
        return describe(name, () => {
            let instance: Contract;
            let factory: ContractFactory;
            let factoryV2: ContractFactory;

            beforeEach(async () => {
                factory = await ethers.getContractFactory(name);
                factoryV2 = await ethers.getContractFactory(`${name}V2`);
            });

            it("should be deployable", async () => {
                instance = await deployProxy(factory, initParams);
            });

            it("should be upgradeable", async () => {
                instance = instance || (await deployProxy(factory, initParams));

                if (beforeUpgrade) {
                    await beforeUpgrade(instance);
                }

                const upgradedInstance = await upgradeProxy(
                    instance.address,
                    factoryV2,
                );

                expect(upgradedInstance.address).to.be.eq(instance.address);

                expect(upgradedInstance.checkUpgrade).to.not.eq(undefined);
                const upgradeResult = await upgradedInstance.checkUpgrade();

                if (typeof upgradeResult === "string") {
                    expect(upgradeResult).to.be.eq(upgradeText);
                } else {
                    expect(upgradeResult[0]).to.be.eq(upgradeText);

                    if (
                        upgradeCheckParams &&
                        Array.isArray(upgradeCheckParams)
                    ) {
                        for (let i = 0; i < upgradeCheckParams.length; i++) {
                            const expected = upgradeCheckParams[i];
                            const actual = upgradeResult[i + 1];
                            expect(expected).to.eq(actual);
                        }
                    }
                }
            });
        });
    });
});
