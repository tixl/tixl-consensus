# Stellar Consensus Protocol in Typescript for Tixl

This should be considered a prototype which is WIP. The consensus algorithm is only one part of the Tixl core. We decided to make it open source because we don't see a significant risk of somebody stealing the code and using it for another privacy coin. You will see a lot of commits in this repository over the next weeks. We think that combined with the commit messages of the other repositories being pushed into Discord, a good overview of our technical progress is given.

## Installation
1. Clone the repository
2. `yarn` to install
3. `yarn start` to run a simulation

You can pass command line arguments.:

- `--help` show all arguments
- `-s --slot` Select slot for this run (default 1)
- `-r --runs` Set count of runs. (default 1)
- `-x --mindelay` Set lower bound of message delay in ms (default 50)
- `-y --maxdelay` Set upper bound of message delay in ms (default 100)
- `-g --seed` Set the seed for the random numbers
- `--debug true` Show advanced logs

Example:  
`yarn start -x 1000 -y 5000 --debug true`

## Configuration
You can define the slices of the nodes in the  `config.toml` file. Default is each four nodes A,B,C,D and each needs agreement with two other of those nodes. 

## Federated Byzantine Agreement System Visualisation
If you want to see the visualization for the FBAS follow these steps: 

- `git checkout b20658a7f80c4fda4e5c15aed60b01707d4691f4`
- `yarn` in both folders
- `yarn start` in both folders
- Open multiple tabs in browser to run multiple clients

If you want to understand the basics of FBAS please read our [Medium article](https://medium.com/tixlcurrency/federated-byzantine-agreement-system-and-tixl-c60254ea2439).

