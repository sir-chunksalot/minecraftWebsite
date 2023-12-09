// Elements
const consoleLines = document.getElementById('lines')
const consoleForm = document.getElementById('console-form')
const consoleInput = document.getElementById('console-input')
const startServerButton = document.getElementById("start-server")
const stopServerButton = document.getElementById("stop-server")
const playerList = document.getElementsByClassName("players")[0]
const serverOnlineState = document.getElementById("status")
const gamerules = document.getElementById("gamerules")

// Socket
const socket = io()

// Variables
let players = []

socket.on('connect', () => {
    console.log('connected')
})

socket.on('disconnect', () => {
    console.warn('disconnected')
})

socket.on('server_state', (on) => {
    if(on) serverOnlineState.className = "online"
    else serverOnlineState.className = "offline"
})

socket.on('gamerules', (data) => {
    console.log(data)
    document.getElementById("gamerule-pvp").checked = data["pvp"] 
    document.getElementById("gamerule-keepinventory").checked = data["keepInventory"] 
    document.getElementById("gamerule-setday").checked = data["doDaylightCycle"] 
    document.getElementById("gamerule-difficulty").checked = data["difficulty"] 
})

socket.on('console', line => {
    const lineElement = document.createElement('p')
    lineElement.className = 'line'
    lineElement.innerText = line
    consoleLines.appendChild(lineElement)
    if (consoleLines.children.length > 100) {
        consoleLines.removeChild(consoleLines.firstChild)
    }
    console.log(consoleLines.scrollTop / consoleLines.scrollHeight) // TODO: Stop scrolling when not at the bottom
    consoleLines.scrollTo({
        top: consoleLines.scrollHeight,
        behavior: 'smooth'
    })
})

socket.on('players', pp => {
    // for (const player of players) { // for (PlayerData data : players) | for data in players:
    //     const gamemode = player['gamemode']
    //     const pvp = player['pvp']
    // }
    // <div class="player">
    //     <p>PLAYER_NAME</p>
    //     <button title="Creative Mode" class="creative"></button>
    //     <button title="Survival Mode" class="survival"></button>
    //     <button title="Teleport" class="teleport"></button>
    //     <button title="Kick" class="kick"></button>
    // </div>
    players = pp
    while (playerList.firstChild) {
        playerList.removeChild(playerList.firstChild)
    }
    for (const p of pp) {
        const { name, gamemode, pvp } = p
        const playerContainer = document.createElement('div')
        playerContainer.className = 'player'

        const nameTag = document.createElement('p')
        nameTag.innerText = name
        playerContainer.appendChild(nameTag)

        // creative button
        const creativeModeButton = document.createElement('button')
        creativeModeButton.title = 'Creative Mode'
        creativeModeButton.className = 'creative'
        creativeModeButton.addEventListener('click', () => {
            socket.emit('send_command', `gamemode creative ${name}`)
        })
        playerContainer.appendChild(creativeModeButton)
        
        // survival button
        const survivalModeButton = document.createElement('button')
        survivalModeButton.title = 'Survival Mode'
        survivalModeButton.className = 'survival'
        survivalModeButton.addEventListener('click', () => {
            socket.emit('send_command', `gamemode survival ${name}`)
        })
        playerContainer.appendChild(survivalModeButton)

        // teleport button
        const teleportButton = document.createElement('button')
        teleportButton.title = 'Teleport'
        teleportButton.className = 'teleport'
        teleportButton.addEventListener('click', () => {
            createTeleportModal(p)
        })
        playerContainer.appendChild(teleportButton)

        // kick button
        const kickButton = document.createElement('button')
        kickButton.title = 'Kick'
        kickButton.className = 'kick'
        kickButton.addEventListener('click', () => {
            socket.emit('send_command', `kick ${name}`)
        })
        playerContainer.appendChild(kickButton)

        playerList.appendChild(playerContainer)
    }
})

consoleForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    console.log('submit')
    let value = consoleInput.value
    if (value.trim().length == 0) return false
    consoleInput.disabled = true
    await socket.emit('send_command', value)
    consoleInput.value = ''
    consoleInput.disabled = false
    consoleInput.focus()
    return false
})

startServerButton.addEventListener('click', () => {
    socket.emit('start_server')
})

stopServerButton.addEventListener('click', () => {
    socket.emit('stop_server')
})

gamerules.addEventListener('input', event => {
    const gamerule = event.target
    console.log(gamerule)
    if (gamerule.id == "gamerule-pvp") {
        socket.emit("send_command", "pvp")
    }
    else if (gamerule.id == "gamerule-keepinventory") {
        socket.emit("send_command", "gamerule keepInventory " + gamerule.checked)
    }
    else if (gamerule.id == "gamerule-setday") {
        socket.emit("send_command", "time set day")
        socket.emit("send_command", "gamerule doDaylightCycle " + gamerule.checked)
    }
    else if (gamerule.id == "gamerule-difficulty") {
        socket.emit("send_command", "difficulty " + (gamerule.checked ? "easy" : "peaceful"))
    }
})

gamerules.addEventListener('click', event => {
    const action = event.target
    console.log(action.id)
    console.log(action)
    if (action.id == 'gamerule-tpall') {
        console.log("tpall command sent")
        socket.emit("send_command", "tpall")

    }
})

const createModal = () => {
    for (const element of document.getElementsByClassName('modal')) {
        element.remove()
    }
    const modal = document.createElement('div')
    modal.className = 'modal'

    const dimmer = document.createElement('div')
    dimmer.className = 'dimmer'
    dimmer.addEventListener('click', () => {
        removeModal(modal)
    })
    modal.appendChild(dimmer)

    const content = document.createElement('div')
    content.className = 'content'
    modal.appendChild(content)

    document.body.appendChild(modal)

    return { modal, content }
}

/**
 * Removes
 * @param {HTMLDivElement} modal - Modal element
 */
const removeModal = modal => {
    modal.classList.add('close')
    modal.addEventListener('transitionend', () => {
        modal.remove()
    })
}

const createTeleportModal = targetPlayer => {
    const { modal, content } = createModal()

    const list = document.createElement('div')
    list.className = 'players'
    content.appendChild(list)

    for (const { name } of players) {
        if (targetPlayer.name == name) continue
        const playerContainer = document.createElement('div')
        playerContainer.className = 'player'

        const nameTag = document.createElement('p')
        nameTag.innerText = name
        playerContainer.appendChild(nameTag)

        // teleport button
        const teleportButton = document.createElement('button')
        teleportButton.title = 'Teleport'
        teleportButton.className = 'teleport'
        teleportButton.addEventListener('click', () => {
            socket.emit('send_command', `tp ${targetPlayer.name} ${name}`)
            removeModal(modal)
        })
        playerContainer.appendChild(teleportButton)

        list.appendChild(playerContainer)
    }
}