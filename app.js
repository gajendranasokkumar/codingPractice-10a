const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')


const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

app.use(express.json())

const initDbandStart = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server is Started!!')
    })
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

initDbandStart()


const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};


app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ "jwtToken": jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const getres = one => {
  return {
    stateId: one.state_id,
    stateName: one.state_name,
    population: one.population,
  }
}

app.get('/states/',authenticateToken, async (request, response) => {
  let q1 = 'SELECT * FROM state'
  let allState = await db.all(q1)
  response.send(allState.map(one => getres(one)))
})

app.get('/states/:stateId/',authenticateToken, async (request, response) => {
  const {stateId} = request.params
  let q3 = `SELECT * FROM state WHERE state_id = ${stateId}`
  const oneState = await db.get(q3)
  response.send(getres(oneState))
})

app.post('/districts/',authenticateToken, async (request, response) => {
  let newDist = request.body
  const {districtName, stateId, cases, cured, active, deaths} = newDist
  let q2 = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`

  let dbResponse = await db.run(q2)
  let insertedId = dbResponse.lastID

  response.send('District Successfully Added')
})

const getdis = one => {
  return {
    districtId: one.district_id,
    districtName: one.district_name,
    stateId: one.state_name,
    cases: one.cases,
    cured: one.cured,
    active: one.active,
    deaths: one.deaths,
  }
}

app.get('/districts/:districtId/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  let q3 = `SELECT * FROM district WHERE district_id = ${districtId}`
  const oneDist = await db.get(q3)
  response.send(getdis(oneDist))
})

app.delete('/districts/:districtId/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  let q5 = `DELETE FROM district WHERE district_id = ${districtId};`
  await db.run(q5)
  response.send('District Removed')
})

app.put('/districts/:districtId/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  let newDist = request.body
  const {districtName, stateId, cases, cured, active, deaths} = newDist
  let q6 = `UPDATE district SET 
  district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  WHERE district_id = ${districtId};`
  await db.run(q6)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/',authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const q7 = `SELECT SUM(cases) AS totalCases ,
                SUM(cured) AS totalCured,
                SUM(active) AS totalActive,
                SUM(deaths) AS totalDeaths
                FROM district WHERE state_id = ${stateId}
                GROUP BY state_id`
  const totalRes = await db.all(q7)
  response.send(totalRes)
})

app.get('/districts/:districtId/details/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const getDistrictIdQuery = `
    select state_id from district
    where district_id = ${districtId};
    `
  const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery)
  const getStateNameQuery = `
    select state_name as stateName from state
    where state_id = ${getDistrictIdQueryResponse.state_id};
    ` //With this we will get state_name as stateName using the state_id
  const getStateNameQueryResponse = await db.get(getStateNameQuery)
  response.send(getStateNameQueryResponse)
})

module.exports = app
