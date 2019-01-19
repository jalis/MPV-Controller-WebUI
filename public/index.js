var updateTimer=null;
var updateInterval=5000;
var updateRequestSent=false;

var seekbarTimer=null;
var seekbarUpdateInterval=100;
var seekbarElement=null;
var seekbarDurationElement=null;
var seekbarPos=0;
var seekbarDuration=0;
var seekbarDelay=100;
var seekbarDelayTimer=null;

var playlistForm=null;

var mediaTitleElement=null;

var playlistList=null;
var currentPlaylist=null;
var currentPlaylistID=null;
var currentPlaylistSelection=null;
var playlistUpdateKey=0;

var currentFilelistSelection=null;

var fileBrowser=null;

document.addEventListener('DOMContentLoaded',function() {
    playlistList=document.getElementById("playlist-container");
    playlistList.addEventListener('click', playlistSelect);
    playlistList.addEventListener('dblclick', playlistChange);

    fileBrowser=document.getElementById("file-browser");
    fileBrowser.addEventListener('click', filelistSelect);
    fileBrowser.addEventListener('dblclick', filelistAdd);

    document.getElementById("control-buttons").addEventListener('click', controlsSubmit);

    document.getElementById("seekbar-form").addEventListener('input', seekbarInput);
    document.getElementById("seekbar-buttons").addEventListener('click', controlsSubmit);

    seekbarElement=document.getElementById('seekbar');
    seekbarDurationElement=document.getElementById('seekbar-duration');
    seekbarPos=Number(seekbarElement.value);
    seekbarDuration=Number(seekbarElement.max);

    var current=null;
    if(current=document.querySelector(".playlist-item-current")) {
        currentPlaylistID=Number(current.dataset.playlistId)
    }
    playlistUpdateKey=Number(document.getElementById("playlist-container").dataset.updateKey);

    updateTimer=setInterval(updatePage, updateInterval);

    if(seekbarElement.dataset.startPaused==="false") {
        seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval)
    }

    playlistForm=document.getElementById("playlist-form");
    mediaTitleElement=document.getElementById("media-title");
},false);

function sendCommand(cmd, arg, callback_func=function(){}) {
    var target='./'+cmd;

    if(arg) {
        target+='/' + arg
    }

    fetch(target).then(
        function(response) {
            if(response.status !== 200) {
                console.log('Error status: '+ response.status);
                callback_func(null, false);
                return;
            }

            response.json().then(function(data) {
                callback_func(data, true);
            });
        }
    ).catch(function(err) {
        console.log('Fetch error: ', err);
    });
}

function getUpdates() {
    updateRequestSent=true;

    fetch("./update").then(
        function(response) {
            if(response.status !== 200) {
                console.log('Update error: ' + response.status);
                return;
            }

            response.json().then(function(data) {
                if(data[0]) {
                    mediaTitleElement.textContent=data[0];
                }

                if(data[1] && data[2]) {
                    seekbarElement.max=data[1];
                    seekbarDuration=data[1];


                    seekbarDurationElement.textContent=Math.floor(data[1]/60) + ":" + String(Math.floor(data[1] % 60)).padStart(2,'0');

                    seekbarElement.value=data[2];
                    seekbarPos=data[2];
                }
                
                if(data[3] !== currentPlaylistID) {
                    if(playlistList.children[0].children[currentPlaylistID]) {
                        playlistList.children[0].children[currentPlaylistID].classList.remove("playlist-item-current");
                        currentPlaylistID=data[3];
                        playlistList.children[0].children[currentPlaylistID].classList.add("playlist-item-current");
                    }
                }

                if((data[4] || data[5]) && seekbarTimer) {
                    clearInterval(seekbarTimer);
                    seekbarTimer=null;
                } else if(!(data[4] || data[5]) && !seekbarTimer) {
                    seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval);
                }

                if(data[6] !== playlistUpdateKey) {
                    updatePlaylist();
                }
            });
        }
    ).catch(function(err) {
        console.log('Update fetch error: ', err);
    });
}

function playlistChange(e) {
    sendCommand('set-playlist', e.target.dataset.playlistId, function(data, success) {
        if(success) {
            getUpdates();

            if(playlistList.children[0].children[currentPlaylistID]) {
                playlistList.children[0].children[currentPlaylistID].classList.remove("playlist-item-current");
                currentPlaylistID=Number(e.target.dataset.playlistId);
                playlistList.children[0].children[currentPlaylistID].classList.add("playlist-item-current");
            }
        }
    });
}

function seekbarInput(e) {
    clearTimeout(seekbarDelayTimer);
    seekbarDelayTimer=setTimeout(sendCommand, seekbarDelay, "seek", e.target.value)
}
function updatePage() {
    getUpdates();
}

function updateSeekbar() {
    seekbarPos=Number(seekbarElement.value) + (seekbarUpdateInterval/1000);

    if(seekbarPos > seekbarDuration) {
        seekbarPos=seekbarDuration;
    }
    seekbarElement.value=seekbarPos;
}

function stopSeekbarScroll() {
    if(seekbarTimer) {
        clearInterval(seekbarTimer);
        seekbarTimer=null;
    }
}

function pause() {
    sendCommand("cycle","pause", function(data, success) {
        if(success) {
            if(seekbarTimer) {
                clearInterval(seekbarTimer);
                seekbarTimer=null;
            } else {
                seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval)
            }
        }
    });
}

function filelistSelect(e) {
    if(!e.target.dataset.filePath) {
        return;
    }
    if(currentFilelistSelection) {
        currentFilelistSelection.classList.remove("filelist-item-selected");
    }
    currentFilelistSelection=e.target;
    currentFilelistSelection.classList.add("filelist-item-selected");
}
function filelistAdd(e) {
    if(!e.target.dataset.filePath) {
        return;
    }
    if(currentFilelistSelection) {
        currentFilelistSelection.classList.remove("filelist-item-selected");
    }
    currentFilelistSelection=e.target;
    currentFilelistSelection.classList.add("filelist-item-selected");

    sendCommand("play?file="+currentFilelistSelection.dataset.filePath, null, function(data, success) {
        if(success) {
            updatePlaylist();
        }
    });
}
function playlistSelect(e) {
    if(e.target.id==="playlist-list" || e.target.id==="playlist-container") {
        return;
    }
    if(currentPlaylistSelection) {
        currentPlaylistSelection.classList.remove("playlist-item-selected");
    }
    currentPlaylistSelection=e.target;
    currentPlaylistSelection.classList.add("playlist-item-selected");
}
function updatePlaylist() {
    sendCommand("formatted-playlist", null, function(data, success) {
        if(success) {
            currentPlaylistSelection=null;
            document.getElementById("playlist-container").innerHTML=data[0];
            playlistUpdateKey=data[1];
        }
    });
}
function controlsSubmit(e) {
    if(e.target.nodeName!=="BUTTON") {
        return;
    }
    switch(e.target.dataset.function) {
        case "refresh":
            updatePlaylist();
            break;
        case "remove":
            if(currentPlaylistSelection) {
                sendCommand("del-playlist", currentPlaylistSelection.dataset.playlistId, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "play-now":
            if(currentPlaylistSelection) {
                sendCommand("set-playlist", currentPlaylistSelection.dataset.playlistId, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "play-next":
            sendCommand("next", null, function(data, success) {
                if(success) {
                    updatePlaylist();
                }
            });
            break;
        case "play-prev":
            sendCommand("prev", null, function(data, success) {
                if(success) {
                    updatePlaylist();
                }
            });
            break;
        case "add":
            if(currentFilelistSelection) {
                sendCommand("play?file="+currentFilelistSelection.dataset.filePath, null, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "pause":
            pause();
            break;
    }
}