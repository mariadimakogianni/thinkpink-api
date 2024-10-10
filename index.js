const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors'); // Import the 'cors' middleware
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb'); // Import the ObjectId constructor


//define url of mongo
const dbUrl = 'mongodb://localhost:27017/thinkpink';


//import mongo client
const { MongoClient } = require('mongodb');


// import keycloack
const $thinkpink = {};
const Keycloak = require('keycloak-connect');
const axios = require('axios');


//initialize keycloack
const keycloak = new Keycloak({ configFile: 'keycloak.json' });
keycloak.logger = console;


//initialize the connection
const client = new MongoClient('mongodb://localhost:27017/thinkpink');

//Token verification
async function verifyToken(token) {
  try {
    console.log(token);
    const result = await keycloak.grantManager.validateAccessToken(token);
    console.log(result);
    return (result===false) ? 1 : 0; // Token is valid (0) or invalid or expired (1)
  } catch (error) {
    console.log(error);
    console.error('Token verification failed:', error);
    return -1; // Error during token verification
  }
}

async function getUserId(token) {
  try {
    const introspectionUrl = 'http://localhost:8081/realms/ThinkPink/protocol/openid-connect/token/introspect';
    const introspectionConfig = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };

    const introspectionData = new URLSearchParams();
    introspectionData.append('token', token);
    introspectionData.append('client_id', 'thesis-thinkpink');
    introspectionData.append('grant_type', 'urn:ietf:params:oauth:grant-type:uma-ticket');

    const response = await axios.post(introspectionUrl, introspectionData.toString(), introspectionConfig);

    if (response.data.active) {
      return response.data.sub; //sub contains user id
    } else {
      throw new Error('Invalid token');
    }
  } catch (error) {
    console.error('Failed to retrieve client_id:', error);
    return -1;
  }
}

async function tokenVerification(req, res, next) {

  const token = req.headers.authorization?.split(' ')[1];

  try {
    const tokenValid = await verifyToken(token);
    if (tokenValid !== 0) {
      res.status(401).json({ error: 'Token invalid or expired' });
      return;
    }

    const userId = await getUserId(token);
    if (userId === -1) {
      res.status(401).json({ error: 'Token invalid or expired' });
      return;
    }

    req.userId = userId;
    // if (allowedClients && !isClientIdInArray(clientId, allowedClients)) {
    //   res.status(401).json({ error: 'Permission Denied' });
    //   return;
    // }

    // All checks passed, proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

$thinkpink.verifyToken = tokenVerification;



// Allow requests from this origin
app.use(cors({ origin: 'http://localhost:8080' })); 
app.use(bodyParser.json());


//API
app.get('/getEvents', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	//const objectId = new ObjectId("65395ca09544dacb9c7372ab");
	var result = await collection.find({ userId: req.userId }).toArray();

    res.json(result);
});

app.post('/createEvent', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    // Assuming you have a request body containing the event data
    //const eventData = req.body;
    const eventData = {
        ...req.body,
        userId: req.userId
      };

    console.log("Inserted event: "+JSON.stringify(eventData)) 
    // Insert the eventData into the 'events' collection
    const result = await collection.insertOne(eventData);

    // Check if the insertion was successful
    if (result.insertedCount == 1) {
      res.status(201).json({ message: 'Event created successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.patch('/editEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    const event_id = req.params.event_id;
    const updateData = req.body;

    // Remove _id from updateData
    if ('_id' in updateData) {
      delete updateData._id;
    }

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    console.log(`Updating event ${event_id} with data:`, updateData);
    const result = await collection.updateOne(
      { _id: new ObjectId(event_id) },
      { $set: updateData }
    );

  res.status(200).send('OK');
   console.log(req.body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.put('/doneEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    const event_id = req.params.event_id;

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    console.log(`Updating event ${event_id} with done=true`);
    const result = await collection.updateOne(
    { _id: new ObjectId(event_id) },  
    { $set: { done: true } }            

); 
    res.status(200).send('OK');
   // console.log(req.body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    const event_id = req.params.event_id;
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    const result = await collection.deleteOne({ _id: new ObjectId(event_id) });
    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  } finally {
    await client.close();
  }
});

app.get('/getLists', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');

    const lists = await collection.find({}).toArray();
    lists.forEach(list => {
      console.log('List:', list);
      console.log('Items:', list.items);  // Log the items array explicitly
    });
    res.json(lists);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});



app.post('/createList', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');

    const listData = req.body;

    console.log("Inserted list: " + JSON.stringify(listData));

    const result = await collection.insertOne(listData);

    if (result.insertedId) {
      res.status(201).json({ message: 'List created successfully', listId: result.insertedId });
    } else {
      res.status(500).json({ message: 'Failed to create list' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteList/:list_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');
    const list_id = req.params.list_id;

    const result = await collection.deleteOne({ _id: new ObjectId(list_id) });

    if (result.deletedCount === 1) {
      console.log("List deleted successfully", list_id);
      res.status(200).json({ message: 'List deleted successfully' });
    } else {
      res.status(404).json({ message: 'List not found' });
    }
  } catch (error) {
    console.error('Error in deleteList:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});

app.post('/addItemToList/:list_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');
    const list_id = req.params.list_id;
    const newItem = req.body;

    console.log("Adding item to list:", list_id);
    console.log("New item:", newItem);

     if (!newItem._id) {
      newItem._id = new ObjectId(); 
    }

    const list = await collection.findOne({ _id: new ObjectId(list_id) });

    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }
    if (!Array.isArray(list.items)) {
          list.items = [];
        }

    list.items.push(newItem);

    const result = await collection.updateOne(
      { _id: new ObjectId(list_id) },
      { $push: { items: list.items } }
    );
  
    if (result.modifiedCount === 1) {
      console.log("Update result:", result);
      res.status(200).json({ message: 'Item added successfully api', newItem });
    } else {
      res.status(404).json({ message: 'List not found' });
    }
  } catch (error) {
    console.error('Error in addItemToList:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});

app.delete('/deleteItemFromList/:list_id/:item_index', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thesis-thinkpink']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');
    const list_id = req.params.list_id;
    const item_index = parseInt(req.params.item_index);

    const list = await collection.findOne({ _id: new ObjectId(list_id) });

    if (list) {
      if (item_index >= 0 && item_index < list.items.length) {
        list.items.splice(item_index, 1);

        const result = await collection.updateOne(
          { _id: new ObjectId(list_id) },
          { $set: { items: list.items } }
        );
        res.status(200).json({ message: 'Item deleted successfully' });
      } else {
        res.status(400).json({ message: 'Invalid item index' });
      }
    } else {
      res.status(404).json({ message: 'List not found' });
    }
  } catch (error) {
    console.error('Error in deleteItemFromList:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});

const API_PORT = process.env.API_PORT || 3000;
app.listen(API_PORT, () => console.log(`Express API listening on port ${API_PORT}`));

