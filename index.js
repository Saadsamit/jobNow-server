const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.amhrtlq.mongodb.net/?retryWrites=true&w=majority`;
const verifyToken = async (req,res,next) => {
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({ message: "not authorized" })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SERCRET,(err, decoded)=>{
    if(err){
      return res.status(401).sent({ message: "unauthorized access" })
    }
    req.user = decoded
    next()
  })
};
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const myDb = client.db("jobNow");
    const allJobsCollection = myDb.collection("allJobs");
    const applyJobsCollection = myDb.collection("applyJobs");

    // Send a ping to confirm a successful connection
    app.post('/api/v1/jwt',async (req,res)=>{
      const user = req.body;
      console.log(process.env.ACCESS_TOKEN_SERCRET);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SERCRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    })
    app.get("/api/v1/allJobs", async (req, res) => {
      let qurey = {};
      if (req.query.category) {
        qurey = { category: req.query.category };
      }
      if (req.query.search?.length > 0) {
        // qurey = { category: req.query.category };
        qurey = {
          title: { $regex: req.query.search, $options: "i" },
        };
      }
      const alljobs = await allJobsCollection.find(qurey).toArray();
      res.send(alljobs);
    });
    app.get("/api/v1/allJobs/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email,
      };
      const FindMyJob = await allJobsCollection.find(query).toArray();
      res.send(FindMyJob);
    });
    app.get("/api/v1/Job-detail/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const jobDetail = await allJobsCollection.findOne(query);
      res.send(jobDetail);
    });
    app.post("/api/v1/add-job",verifyToken, async (req, res) => {
      const data = req.body;
      const addJob = await allJobsCollection.insertOne(data);
      res.send(addJob);
    });
    app.patch("/api/v1/update-job/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = {
        _id: new ObjectId(id),
      };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          imgUrl: data.imgUrl,
          title: data.title,
          category: data.category,
          salary: data.salary,
          description: data.description,
          jobDeadline: data.jobDeadline,
        },
      };
      const updateJob = await allJobsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(updateJob);
    });
    app.patch("/api/v1/apply/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = {
        _id: new ObjectId(id),
      };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          apply: data.apply,
        },
      };
      const updateJob = await allJobsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(updateJob);
    });
    app.delete("/api/v1/delete-job/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const deleteJob = await allJobsCollection.deleteOne(query);
      res.send(deleteJob);
    });
    app.get('/api/v1/applied-job',verifyToken, async(req,res)=>{
      const email = req.query.email
      const query = {
        email: {$eq: email }
      }
      const applyJob = await applyJobsCollection.find(query).toArray()
      const applyId =  applyJob.map((apply=>new ObjectId(apply.applyData)))
      const queryApply = {
        _id: {$in: applyId}
      }
      const FindData = await allJobsCollection.find(queryApply).toArray()
      res.send(FindData)

    })
    app.post("/api/v1/apply-job",verifyToken, async (req, res) => {
      const data = req.body;
      const query = {
        email: data.email
      }
      const queryEmail = {
        email: {$eq: data?.email},
        applyData: {$eq: data?.applyData}
      }
      const FindEmail = await applyJobsCollection.findOne(queryEmail)
      if(FindEmail?._id){
        return res.status(409).send({message: 'already exists'})
      }
      
      const applyJob = await applyJobsCollection.insertOne(data)
      res.send(applyJob)
    });
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port);
