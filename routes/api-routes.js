/* eslint-disable no-unused-vars */
// Requiring our models and passport as we've configured it
const db = require("../models");
const passport = require("../config/passport");
const axios = require("axios");
const Sequelize = require("sequelize");

module.exports = function(app) {
  // Using the passport.authenticate middleware with our local strategy.
  // If the user has valid login credentials, send them to the members page.
  // Otherwise the user will be sent an error
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Sending back a password, even a hashed password, isn't a good idea
    console.log("UserId:" + req.user.id);
    console.log("TeamId:" + req.user.teams_id);

    req.session.userId = req.user.id;
    req.session.teamId = req.user.teams_id;

    res.json({
      email: req.user.email,
      id: req.user.id
    });
  });

  // Route for signing up a user. The user's password is automatically hashed and stored securely thanks to
  // how we configured our Sequelize User Model. If the user is created successfully, proceed to log the user in,
  // otherwise send back an error
  app.post("/api/signup", (req, res) => {
    db.User.create({
      email: req.body.email,
      password: req.body.password
    })
      .then(() => {
        res.redirect(307, "/api/login");
      })
      .catch(err => {
        console.log(err);
        res.status(401).json(err);
      });
  });

  app.get("/api/userscore", (req, res) => {
    db.User.findAll({
      order: [["score", "DESC"]],
      attributes: ["id", "email", "score"],
      where: { score: { [Sequelize.Op.gte]: [0] } }
    }).then(user => {
      res.json(user);
    });
  });

  app.get("/api/teams/avg/:id/:max", (req, res) => {
    db.Team.findByPk(req.params.id).then(team => {
      const response = new Object();
      response.team_id = team.id;
      response.teamname = team.teamname;
      response.percentAvg = `${Math.floor(
        (team.avgScore / req.params.max) * req.params.max
      )}%`;
      res.json(response);
    });
  });

  app.put("/api/userscore", (req, res) => {
    // db.user.findone update by id
    // find user by id update score key
    // grab request body.

    db.User.update(
      {
        score: req.body.score
      },
      {
        where: {
          id: req.user.id
        }
      }
    ).then(dbScore => {
      console.log("****************db score*****************");
      console.log(dbScore);
      console.log(req.user);
      db.User.findOne({ where: { id: req.user.id } }).then(dbUser => {
        console.log(dbUser);
        const teamId = dbUser.dataValues.teams_id;

        db.User.findAll({
          attributes: [[Sequelize.fn("AVG", Sequelize.col("score")), "score"]],
          where: {
            teams_id: teamId
          }
        }).then(userResults => {
          console.log(userResults);
          const user = userResults[0];
          console.log(`User: ${user.score}`);
          console.log(`Team: ${teamId}`);
          db.Team.update(
            {
              avgScore: user.score
            },
            {
              where: {
                id: teamId
              }
            }
          ).then(teamResults => {
            res.json(teamResults);
          });
        });
      });
    });
  });

  app.get("/api/teams/all", (req, res) => {
    db.Team.findAll({ raw: true }).then(response => {
      //      console.log("here");
      //      console.log(response);
      // console.log(response.data);
      //      console.log(response);
      res.send(response);
    });
  });

  app.post("/api/newteam", (req, res) => {
    console.log(req.body.teamname);
    console.log(req.body.avgscore);

    db.Team.create({
      teamname: req.body.teamname,
      avgScore: req.body.avgscore
    }).then(dbTeam => {
      // console.log(req);
      // console.log(dbTeam);
      // console.log(dbTeam.dataValues.id);
      const teamId = dbTeam.dataValues.id;
      const userId = req.user.id;

      db.User.update(
        {
          teams_id: teamId
        },
        {
          where: {
            id: userId
          }
        }
      ).then(dbScore => {
        res.json(dbScore);
      });
    });
  });

  app.post("/api/jointeam", (req, res) => {
    req.session.teamId = req.body.teamid;

    db.User.update(
      {
        teams_id: req.body.teamid
      },
      {
        where: {
          id: req.body.userid
        }
      }
    ).then(dbTeam => {
      res.json(dbTeam);
    });
  });

  app.get("/api/teamscore", (req, res) => {
    db.Team.findAll({
      order: [["avgScore", "DESC"]],
      attributes: ["id", "teamname", "avgScore"],
      where: { avgScore: { [Sequelize.Op.gte]: [0] } }
    }).then(team => {
      res.json(team);
    });
  });

  app.post("/api/startquiz", (req, res) => {
    //   console.log("starting quiz api call.");

    axios
      .get(
        "https://opentdb.com/api.php?amount=10&category=9&difficulty=medium&type=multiple"
      )
      .then(response => {
        //      console.log("here");
        console.log(response.data);
        // console.log(response.data);
        res.send(response.data);
      })
      .catch(error => {
        console.log(error);
      });
    //    res.json({});
  });

  // Route for logging user out
  app.get("/logout", (req, res) => {
    req.logout();
    req.session.destroy();
    res.redirect("/");
  });

  // Route for getting some data about our user to be used client side
  app.get("/api/user_data", (req, res) => {
    console.log("Session User ID: " + req.session.userId);
    console.log("Session Team ID: " + req.session.teamId);

    if (!req.user) {
      // The user is not logged in, send back an empty object
      res.json({});
    } else {
      // Otherwise send back the user's email and id
      // Sending back a password, even a hashed password, isn't a good idea
      res.json({
        email: req.user.email,
        id: req.user.id
      });
    }
  });
};
