# MRBS Hub project
## The github workflow
* Using [hub](https://hub.github.com) command is recommended
* First time setup: fork the repo into your own account's space by using command ```hub fork```, or your can manually setup the remote like this:
```sh
$ git remote -v
liyinsg git@github.com:liyinsg/MRBS.git (fetch)
liyinsg git@github.com:liyinsg/MRBS.git (push)
origin  git@github.com:ftdichipsg/MRBS.git (fetch)
origin  git@github.com:ftdichipsg/MRBS.git (push)

```
* Use `git pull` to update master branch everytime before you plan to create a new branch
* Create a new branch from `master` by using command ```git checkout -b task_name master``` to start working on a new task or issue
* Push the unfinished branch to your own account at least on a daily basis by using command `git push YOUR_GITHUB_USERNAME task_name`
* After task is finished:
  * `git rebase -i task_name` to cleanup commit history since all commits in here will be merged into master
  * `git rebase master` and resolve conflicts
  * Push branch into your own account by using `git push YOUR_GITHUB_USERNAME task_name`
* Send pull request by using command `hub pull-request`, or [manually create pull request](https://help.github.com/articles/creating-a-pull-request/) from github pages. Please remember mention the words like "fix #", detail explain of the keywords can be found at [here](https://help.github.com/articles/closing-issues-using-keywords/)

## Environment setup
* `node.js` version: v8.9.0 or later, LTS version
* `redis`: listen on default port (6379) of localhost
* `TypeScript`: version 2.5.3 is preferred at the moment. 2.6.1 API change breaks YCM code completer

## Editor setup
### vim
* FileType: ```au FileType typescript setlocal expandtab shiftwidth=2 tabstop=2 softtabstop=2```
* Plugins: `leafgarland/typescript-vim, w0rp/ale, Valloric/YouCompleteMe`
### WebStorm
*  Node parameter for typescript debugging: `--inspect --require ts-node/register`

## Check-in guidelines
* Do not check in any files in `.idea`
* Write unit test for your module, try achieve 100% code coverage when possible, you can view the report in `coverage/src/index.html` after run `npm test`
* Make sure your changes pass all unit test `npm test` and linting checks `npm run tslint`

## TypeScript code guidelines
* Prefer async, await over promise
* Prefer for..of over for..in
* Use undefined. Do not use null

## Automated script to install hub command on Linux
```bash
#!/bin/bash
VERSION=2.3.0-pre10

in_cfg()
{
	[ ! -f $1 ] && return 0
	grep "$2" "$1" &> /dev/null
	return $?
}

install_completion()
{
	if [ -d ~/.config/fish ]; then
		[ ! -d ~/.config/fish/completions ] && mkdir ~/.config/fish/completions
		cp ./etc/hub.fish_completion ~/.config/fish/completions/hub.fish
	fi

	if [ -d ~/.zsh ]; then
		[ ! -d ~/.zsh/completions ] && mkdir ~/.zsh/completions
		cp etc/hub.zsh_completion ~/.zsh/completions/_hub
	fi

	if [ -f ~/.bashrc ]; then
		local DIR=/usr/local/etc
		[ ! -d $DIR ] && mkdir $DIR
		cp etc/hub.bash_completion.sh /usr/local/etc/
		! in_cfg $HOME/.bashrc hub.bash_completion && cat << EOT >> $HOME/.bashrc
if [ -f /usr/local/etc/hub.bash_completion ]; then
  . /usr/local/etc/hub.bash_completion
fi
EOT
	fi
}

cd /tmp
NAME=hub-linux-amd64-$VERSION
FILE=$NAME.tgz
wget https://github.com/github/hub/releases/download/v$VERSION/$FILE
tar -xf $FILE
rm $FILE
cd $NAME
./install
install_completion
cd .. && rm -fr $NAME
```
