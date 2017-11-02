# MRBS Hub project
## Environment setup
* node.js version: v8.9.0 or later, LTS version
* redis: listen on default port (6379) of localhost

## Editor setup
### vim
* FileType: ```au FileType typescript setlocal expandtab shiftwidth=2 tabstop=2 softtabstop=2```
* Plugins: `leafgarland/typescript-vim, w0rp/ale, Valloric/YouCompleteMe`
### WebStorm
*  Node parameter for typescript debugging: `--inspect --require ts-node/register`

## Check-in guidelines
* Do not check in files in .idea
* Do not check in to master branch
* Create a new branch to start your work, and push the branch to repository on at least a daily basis
* Write unit test for your module, try achieve 100% code coverage when possible, you can view the report in "coverage/src/index.html" after run "npm test"
* Pass "npm test" and "npm run tslint", call "git fetch", "get rebase" and fix the conflicts before request for review

## Code guidelines
* Prefer async, await over promise
* Prefer for..of over for..in
* Use undefined. Do not use null
