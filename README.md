## Install pre-requisites

```
$ npm i
```

## Compile
```
$ npm run compile
```

## Test
```
$ npm run compile
```

## Generate merkle tree files
* Pre-process csv
```
$ npm run csv2json

> generate-merkle-root
> ts-node scripts/csv2json.ts ./files/GIV_tokens_-_AIRDROP_TEST_LIST.csv ./files/merkle_distributor.json

Total distributed tokens: 14430863000000000000000000
```
* Generate merkle_distributor_result.json
```
$ npm run csv2json

> generate-merkle-root
> ts-node scripts/csv2json.ts ./files/GIV_tokens_-_AIRDROP_TEST_LIST.csv ./files/merkle_distributor.json

Total distributed tokens: 14430863000000000000000000
```
* Get merkletree root 
```
$ cat files/merkle_distributor_result.json | jq '.merkleRoot'
"0x05176bac832b5a9cd000091d231638fe0e854801c447aae625ed2f710c026196"
```

#### Deploy
```
TS_NODE_FILES=true ./node_modules/.bin/ts-node scripts/deploy_merkle_tokendistro.ts --totalTokens 14430863000000000000000000 --startTime 1622548800 --cliffPeriod 0 --duration 1209600 --initialPercentage 1333 --tokenAddress 0xd8d67562307d18fa6c052092da5dc18fc6b13809 --merkleRoot 0x5d063327fd0f8c928dd3f73512c2d7bc7e975cb09526155f63e3e2488c81350b
```