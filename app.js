const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initDBanderver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started...')
    })
  } catch (e) {
    console.log(`DBErr: ${e.message}`)
    process.exit(1)
  }
}

initDBanderver()

//Authenticate Token
const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'abcdefghijkl', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const isUserExist = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(isUserExist)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPassMatched = await bcrypt.compare(password, dbUser.password)
    if (isPassMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = await jwt.sign(payload, 'abcdefghijkl')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//Convert State Obj
const convertStateObj = obj => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

//Convert District Obj
const convertDisToRes = obj => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  }
}

//API 2 GET /states/
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT * FROM state
  ORDER BY state_id;`

  const allStates = await db.all(getStatesQuery)
  response.send(allStates.map(each => convertStateObj(each)))
})

//API 3 GET a State
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT * FROM
  state
  WHERE 
  state_id=${stateId};`

  const oneState = await db.get(getStateQuery)
  response.send(convertStateObj(oneState))
})

//API 4 POST Create a District
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `
  INSERT INTO district(
    district_name,
    state_id,
    cases,
    cured,
    active,
    deaths
  ) VALUES(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`

  await db.run(postQuery)
  response.send('District Successfully Added')
})

//API 5 GET a District
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
  SELECT * FROM
  district
  WHERE
    district_id=${districtId};`

    const oneDistrict = await db.get(getDistrictQuery)
    response.send(convertDisToRes(oneDistrict))
  },
)

//API 6 DELETE
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE
    district_id=${districtId};`

    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//API 7 PUT
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDistrictQuery = `
  UPDATE district
  SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
  WHERE
    district_id=${districtId};
    `

    await db.run(putDistrictQuery)
    response.send('District Details Updated')
  },
)

//API 8 GET Stats
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsQuery = `
  SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
  FROM
    district
  WHERE
    state_id = ${stateId};
    `

    const oneStateStats = await db.get(getStatsQuery)
    response.send(oneStateStats)
  },
)

module.exports = app
