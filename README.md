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
* Use `git checkout master && git pull` to update master branch everytime before you plan to create a new branch or send pull-request
* Create a new branch from `master` by using command `git checkout -b task_name master` to start working on a new task or issue
* Push the unfinished branch to your own account at least on a daily basis by using command `git push YOUR_GITHUB_USERNAME task_name`
* After task is finished:
  * Make sure all files are committed, or using `git stash` to stash for later usage
  * `git checkout master && git pull && git checkout task_name && git rebase master` to rebase to lastest master
    * Add the following alisa into ~/.gitconfig, allow use `git rb BRANCH` to rebase branch to latest master
	```
	[alias]
		rb = !git rev-parse --verify $1 > /dev/null && git checkout master && git pull && git checkout $1 && git rebase master
	```
  * `git rebase -i master` to cleanup commit history
  * Push branch into your own account by using `git push YOUR_GITHUB_USERNAME task_name`
* Send pull request by using command `hub pull-request`, or [manually create pull request](https://help.github.com/articles/creating-a-pull-request/) from github pages. Please remember mention the words like "fix #", detail explain of the keywords can be found at [here](https://help.github.com/articles/closing-issues-using-keywords/)
* To work on multiple tasks at same time:
  * Before switch to another branch name, commit all changes with message starts with "WIP: ". `git stash` also can be used if you will switch back in a short while
  * Please push all branches back to github on a daily basis

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

## Log level guidelines
* error: issues must be addressed by admin
* warn: system is not running in expected environment, but admin can ignore the message
* info: system running state report, and system log / audit information
* verbose: used by customer support to debug issues
* debug: used by developer to debug issues
* silly: information even developer doesn't care most of the time

## RESTful API design guideline
Please following the https://github.com/Microsoft/api-guidelines/blob/vNext/Guidelines.md

## Agent to Hub API
ID                       | Parameters                  | Description
------------------------ | ----------------------------| ------------------------------------------------------------------------------------
 REPORT_AGENT_ID         | uint64_t                    | First message from agent once setup is completed, 6 bytes mac address  + 2bytes ID
 REPORT_UUID             | uint64_t                    | PanL device's UUID, response of GET_UUID
 REPORT_PANL_STATUS      | uint8_t                     | SD_CARD_DAMAGED, SD_CARD_EJECTED, SD_CARD_INSERTED etc
 REPORT_DEVICE_CHANGE    |                             | Agent to report once any PanL device plug or unpluged
 REQUEST_FIRMWARE        |                             | Response of SET_EXPECTED_FIRMWARE_VERSION once version mismatch
 AUTH_BY_PASSCODE        | uint32_t                    | Send before XXX_MEETING messages once rights in SET_ACCESS_RIGHT is enabled
 AUTH_BY_RFID            | uint8_t[11]                 | Send before XXX_MEETING messages once rights in SET_ACCESS_RIGHT is enabled
 GET_LOCAL_TIME          |                             | For future use. Hub will broadcast time at boot up and day change
 SET_ADDRESS             | uint8_t                     | Following messages will be parsed for this PanL address
 GET_TIMELINE            | [GetTimeLine](#gettimeline) | All following GET_MEETING_INFO request will be based on this timeline
 GET_MEETING_BODY        |                             | For future use. Send before GET_MEETING_INFO
 GET_MEETING_INFO        | [TimePoint](#timepoint)     | Get meeting info based on previous requested timeline
 EXTEND_MEETING          | [TimeSpan](#timespan)       | Hub will response SET_ERROR_CODE with ERROR_SUCCUESS if requested been sent
 CANCEL_MEETING          | [TimePoint](#timepoint)     | Once success the meeting will be removed from timeline
 END_MEETING             | [TimePoint](#timepoint)     | End time will be modified to current time
 CANCEL_UNCLAIM_MEETING  | [TimePoint](#timepoint)     | Agent should send this once meeting is unclaimed
 CREATE_BOOKING          | [TimeSpan](#timespan)       |
 CHECK_CLAIM_MEETING     | [TimePoint](#timepoint)     | Check if last crendential is allowed to claim the meeting

## Hub to Agent API
ID                             | Parameters                    | Description
------------------------------ | ------------------------------| ------------------------------------------------------------------------------------
 SET_ADDRESS                   | [SetAddress](#setaddress)     | All following messages shall be sent to the MSTP address
 SET_POWER_OFF                 | uint8_t                       | Bitmap for power control, disable the port power once all bits are set
 SET_TIMEOUT                   | uint8_t                       | PanL timeout, in seconds
 SET_LOCAL_TIME                | [SetLocalTime](#setlocaltime) |
 SET_TIME_FORMAT               | boolean militoryTime          |
 SET_EXPECTED_FIRMWARE_VERSION | uint16_t                      |
 WRITE_ASSERTS                 | [WriteAsset](#writeasset)     |
 WRITE_FIRMWARE                | [Blob](#blob)                 | Firmware binary data
 SET_LANGID                    | uint8_t                       | For future use
 SET_ROOM_SIZE                 | uint16_t                      | For future use
 SET_ROOM_EQUIPMENTS           | uint8_t                       | For future use
 SET_ACCESS_RIGHT              | [AccessRight](#accessright)   |
 SET_HARDWARE_FEATURE          | [Hardware](#hardware)         |
 SET_BACKLIGHT                 | boolean on                    | Set to false will turn off LCD panel and backlight
 SET_ROOM_NAME                 | String                        | UTF8 string
 SET_TIMELINE                  | [SetTimeline](#settimeline)   | Response of GET_TIMELINE
 ON_MEETING_END_TIME_CHANGED   | [TimeSpan](#timespan)         |
 ON_ADD_MEETING                | [TimeSpan](#timespan)         |
 ON_DEL_MEETING                | [TimePoint](#timepoint)       |
 ON_MEETING_INFO_CHANGED       | [TimePoint](#timepoint)       | Only meeting info changed, both start and end time no change
 SET_MEETING_INFO              | [MeetingInfo](#meetinginfo)   | Response of GET_MEETINGINFO
 SET_MEETING_BODY              | [String](#string)             |
 SET_ERROR_CODE                | [HubErrorCode](#huberrorcode) |
 GET_UUID                      |                               | PanL shall response with REPORT_UUID
 SET_UNCONFIGURED_ID           | uint16_t                      | Number used to identify unconfigured devices, dismiss after received SET_ROOM_NAME

## Hub to Agent parameters
### GetTimeline
```c
// day_offset 0 == today, +1 == tomorrow, -1 == yesterday
// PanL should not change base of day_offset util received SET_LOCAL_TIME broadcast from Hub.
int8_t day_offset;
struct {
  unsigned int start_time : 11;
  unsigned int reserved : 4;
  unsigned int look_forward : 1;
};
uint8_t max_count;
```

### TimePoint
```c
  int8_t day_offset;
  uint16_t start_time;
```

### TimeSpan
```c
  TimePoint point;
  uint16_t duration;
```

### SetAddress
```c
uint8_t addr;
uint16_t length;
```

### SetLocalTime
```c
// Year offsets from 2017, up to 2080
struct {
	int seconds_of_day : 17;
	int day : 5;
	int month : 4;
	int year : 6;
}
```

### String
```c
uint8_t len;
uint8_t str[len];
```

### Blob
```c
uint32_t len;
uint8_t data[len];
```

### WriteAsset
```c
// path is location information, e.g. memory, file system, database etc
String path;
// data is the blob content of the path
Blob data;
```

### AccessRight
```c
struct MeetingControlUnit {
  bool extendMeeting : 1;
  bool claimMeeting : 1;
  bool cancelMeeting : 1;
  bool endMeeting : 1;
  bool onSpotBooking : 1;
  bool featureBooking : 1;
  bool reserved : 2;
};
struct AccessRight {
	struct MeetingControlUnit featureDisabled;
	struct MeetingControlUnit requireAuthentication;
	struct MeetingControlUnit authAllowPasscode;
	struct MeetingControlUnit authAllowRFID;
};
```

### Hardware
```c
struct {
	int mute : 1;
	int led_off : 1;
	int rfid_off : 1;
	int reserved : 5;
}
```

### SetTimeline
```c
uint8_t day_offset;
uint8_t count;
struct {
  uint16_t start_time;
  uint16_t end_time;
} busy[count];
```

### MeetingInfo
```c
uint32_t subject_length;
uint32_t organizer_length;
uint8_t utf8[subject_length + organizer_length];
```

### HubErrorCode
```c
// stored as uint8_t
enum HubErrorCode {
  ERROR_SUCCESS,
  ERROR_AUTH_ERROR,
  ERROR_FEATURE_DISABLED,
  ERROR_CERTIFICATE,
  ERROR_NETWORK,
}
```

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
