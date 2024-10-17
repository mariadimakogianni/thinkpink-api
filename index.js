const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors'); 

// Allow requests from this origin
app.use(cors({ origin: 'http://localhost:8080' })); 

const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb'); // Import the ObjectId constructor
const fs = require('fs');
const path = require('path');

//define url of mongo
const dbUrl = 'mongodb://localhost:27017/thinkpink';


//import mongo client
const { MongoClient } = require('mongodb');


// import keycloack
const $thinkpink = {};
const Keycloak = require('keycloak-connect');
const axios = require('axios');

var keycloakConf={
  realm: "ThinkPink",
  "auth-server-url": "http://localhost:8081",
  "ssl-required": "external",
  resource: "thinkpink-api",
  credentials: {
    secret: "" //injected from 'keycloak-secret' file
  },
  "bearer-only": true,
  "confidential-port": 0
};

keycloakConf.credentials.secret=fs.readFileSync(path.join(__dirname, 'keycloak-secret'), 'utf-8').trim();

//initialize keycloack
const keycloak = new Keycloak({},keycloakConf);
keycloak.logger = console;


//initialize the connection
const client = new MongoClient('mongodb://localhost:27017/thinkpink');

//Retrive Email for Project SHaring
async function findUserIdByEmail(email) {
  try {
    const keycloakTokenUrl = 'http://localhost:8081/realms/ThinkPink/protocol/openid-connect/token';
    const keycloakAdminUrl = 'http://localhost:8081/admin/realms/ThinkPink/users';
    const clientSecret = fs.readFileSync(path.join(__dirname, 'keycloak-secret'), 'utf-8').trim();

    // Get admin access token for Keycloak
    const tokenResponse = await axios.post(
      keycloakTokenUrl,
      {
        client_id: 'thinkpink-api', 
        client_secret: clientSecret, 
        grant_type: 'client_credentials' 
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    console.log('Keycloak admin token obtained successfully');

    const admintoken = tokenResponse.data.access_token;

    // Search for the user by email
    const usersResponse = await axios.get(`${keycloakAdminUrl}?email=${email}`, {
      headers: { Authorization: `Bearer ${admintoken}` , 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    console.log(`Keycloak user search response: ${JSON.stringify(usersResponse.data)}`); 

    if (usersResponse.data.length > 0) {
      console.log(`User found: ${usersResponse.data[0].email}, ID: ${usersResponse.data[0].id}`);
      return usersResponse.data[0]; // Return the user object (contains ID and email)
    } else {
      console.log('No user found with the provided email');
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
}



//Token verification
async function verifyToken(token) {
  try {
    // console.log(token);
    const result = await keycloak.grantManager.validateAccessToken(token);

    console.log(result);
    return (result===false) ? 1 : 0; // Token is valid (0) or invalid or expired (1)
  } catch (error) {
    // console.log(error);
    console.error('Token verification failed:', error);
    return -1; 
  }
}

async function resolveUser(token) {
  try {
    const userInfoUrl = 'http://localhost:8081/realms/ThinkPink/protocol/openid-connect/userinfo';
    const userInfoConfig = {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const response = await axios.get(userInfoUrl, userInfoConfig);

    // Check if the user information user ID
    if (response.data && response.data.sub) {
      console.log(response.data);
      console.log(response.data.assigned_user_name);
      return response.data.is_caregiver?[response.data.sub,response.data.is_caregiver,response.data.assigned_user,response.data.assigned_user_name]:[response.data.sub,response.data.is_caregiver]; 

    } else {
      throw new Error('User information does not contain a valid user ID');
    }
  } catch (error) {
    console.error('Failed to retrieve user ID:', error);
    return -1; 
  }
}


async function tokenVerification(req, res, next) {

  const token = req.headers.authorization?.split(' ')[1];
  console.log(token);

  try {
    const tokenValid = await verifyToken(token);
    console.log(!tokenValid?"Token Is Valid":"Unauthorized");
    if (tokenValid !== 0) {
      res.status(401).json({ error: 'Token invalid or expired' });
      return;
    }

    const resolvedUser = await resolveUser(token);
    if (resolvedUser[0] === -1) {
      res.status(401).json({ error: 'Token invalid or expired' });
      return;
    }

    req.userId = resolvedUser[0];
    req.isCaregiver = resolvedUser[1];
    if(req.isCaregiver) req.assignedUser = resolvedUser[2];
    if(req.isCaregiver) req.assignedUserName = resolvedUser[3];
    console.log("req",req.userId,req.isCaregiver,req.assignedUser,req.assignedUserName);
    console.log("tokenver complete");
    // All checks passed, proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

$thinkpink.verifyToken = tokenVerification;

app.use(bodyParser.json());

app.put('/updateUserProfile', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    
    const { firstName, lastName, email, password} = req.body;
    const userId = req.userId; // userId from the validated token

    //Get admin token from Keycloak
    const keycloakTokenUrl = 'http://localhost:8081/realms/ThinkPink/protocol/openid-connect/token';
    const keycloakAdminUrl = `http://localhost:8081/admin/realms/ThinkPink/users/${userId}`; // Admin endpoint for updating user
    const clientSecret = fs.readFileSync(path.join(__dirname, 'keycloak-secret'), 'utf-8').trim();

    const tokenResponse = await axios.post(
      keycloakTokenUrl,
      `client_id=thinkpink-api&client_secret=${clientSecret}&grant_type=client_credentials`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const adminToken = tokenResponse.data.access_token;

    // const decodedToken = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString());
    // console.log('Decoded admin token:', decodedToken);


    console.log('Keycloak admin token obtained successfully',adminToken);

    // Make the request to update user profile using the Admin API
    const updateProfileResponse = await axios.put(
      keycloakAdminUrl,
      {
        firstName: firstName,
        lastName: lastName,
        email: email,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (updateProfileResponse.status === 204) { 
      res.status(200).json({ message: 'Profile updated successfully' });
    } else {
      res.status(updateResponse.status).json({ message: 'Failed to update profile in Keycloak' });
    }


  } catch (error) {
    console.error('Error updating profile in Keycloak:', error.response?.data || error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/assignCaregiver', async (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    const { isCaregiver, userEmail } = req.body;
    const userId = req.userId; 

     console.log(`Current logged-in user ID: ${userId}`);

    console.log("email",userEmail);

    // Get admin token from Keycloak
    const keycloakTokenUrl = 'http://localhost:8081/realms/ThinkPink/protocol/openid-connect/token';
    const keycloakAdminUrl = `http://localhost:8081/admin/realms/ThinkPink/users/${userId}`;
    const clientSecret = fs.readFileSync(path.join(__dirname, 'keycloak-secret'), 'utf-8').trim();

    const tokenResponse = await axios.post(
      keycloakTokenUrl,
      `client_id=thinkpink-api&client_secret=${clientSecret}&grant_type=client_credentials`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const adminToken = tokenResponse.data.access_token;
    console.log('Keycloak admin token obtained successfully');

    const assignedUser = await findUserIdByEmail(userEmail);

    console.log(`User to be caregiver: ${userEmail} (ID: ${assignedUser.id})`);

    //check if assignedUser is already a caregiver
    const assignedUserUrl = `http://localhost:8081/admin/realms/ThinkPink/users/${assignedUser.id}`;
    const assignedUserResponse = await axios.get(assignedUserUrl, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const assignedUserData = assignedUserResponse.data;

    console.log("assignes user data ", assignedUserData);

    if (assignedUserData.attributes &&
      Array.isArray(assignedUserData.attributes.is_caregiver) && 
      assignedUserData.attributes.is_caregiver.includes('true')) {
      console.log(`User ${assignedUser.email} is already a caregiver. Cannot reassign.`);
      return res.status(400).json({ message: 'The user is already a caregiver and cannot be reassigned.' });
    }

    //get current user data and change them
    const userResponse = await axios.get(keycloakAdminUrl, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const userData = userResponse.data;

    userData.attributes = {
      ...userData.attributes, // keep existing attributes
      is_caregiver: true,
      assigned_user: assignedUser.id,
      assigned_user_name: assignedUser.email,
    };


    const updateCaregiver = await axios.put(
      keycloakAdminUrl,
      userData,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (updateCaregiver.status === 204) {
      return res.status(200).json({ message: 'Caregiver assignment updated successfully' });
    } else {
      return res.status(updateCaregiver.status).json({ message: 'Failed to update caregiver assignment' });
    }
  } catch (error) {
    console.error('Error assigning caregiver:', error.message || error);
    res.status(500).json({ message: 'Internal server error', error: error.message || error });
  }
});





//API
app.get('/getEvents', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	//const objectId = new ObjectId("65395ca09544dacb9c7372ab");
  var eId=req.isCaregiver?req.assignedUser:req.userId;
	 //var result = await collection.find({ userId: eId }).toArray();

   var result = await collection.find({ 
    userId: eId, 
    noShow: { $ne: true } 
    }).toArray();

    res.json(result);
});

app.post('/createEvent', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');
    var eId=req.isCaregiver?req.assignedUser:req.userId;
    const eventData = {
        ...req.body,
        userId: eId
      };

    console.log("Inserted event: "+JSON.stringify(eventData)) 

    const result = await collection.insertOne(eventData);
    console.log(result);

    if (result.acknowledged) {
      res.status(201).send("Created");
    }
  } catch (error) {
    console.error(error);
    res.status(403).send("Internal server error");
  } finally {
    await client.close();
  }
});

app.patch('/editEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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

app.put('/doneEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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

app.delete('/deleteEvent/:event_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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


app.get('/getLists', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');

    const lists = await collection.find({userId: req.userId}).toArray();
    lists.forEach(list => {
      console.log('List:', list);
      console.log('Items:', list.items); 
    });
    res.json(lists);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});



app.post('/createList', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');

    const listData = {
        ...req.body,
        userId: req.userId
      };

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

app.delete('/deleteList/:list_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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

app.post('/addItemToList/:list_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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

     const result = await collection.updateOne(
      { _id: new ObjectId(list_id) },
      { $push: { items: newItem } }
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

app.patch('/updateItemDoneLists/:list_id/:item_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('lists');
    const list_id = req.params.list_id;
    const item_id = req.params.item_id;
    const done = req.body.done;

    const result = await collection.updateOne(
      { _id: new ObjectId(list_id), "items._id": new ObjectId(item_id) },
      { $set: { "items.$.done": done } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: 'Item updated successfully' });
    } else {
      res.status(404).json({ message: 'Item or list not found' });
    }
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteItemFromList/:list_id/:item_index', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
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

app.get('/getProjects', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {

    const userId = req.userId;

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');

    const projects = await collection.find({
      $or: [
        { userId: userId }, // Projects owned by the user
        { 'sharedWith.userId': userId } // Projects shared with the user
      ],
    }).toArray();

    projects.forEach(project => {
      console.log('Project:', project);
      console.log('Items:', project.items); 
    });

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.post('/createProject', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');

    const projectData = {
        ...req.body,
        userId: req.userId
      };

    console.log("Inserted project: " + JSON.stringify(projectData));

    const result = await collection.insertOne(projectData);

    if (result.insertedId) {
      res.status(201).json({ message: 'Project created successfully', projectId: result.insertedId });
    } else {
      res.status(500).json({ message: 'Failed to create project' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteProject/:project_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');
    const project_id = req.params.project_id;

    const result = await collection.deleteOne({ _id: new ObjectId(project_id) });

    if (result.deletedCount === 1) {
      console.log("Project deleted successfully", project_id);
      res.status(200).json({ message: 'Project deleted successfully' });
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error('Error in deleteProject:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});

app.post('/addItemToProject/:project_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');
    const project_id = req.params.project_id;
    const newItem = req.body;

    console.log("Adding item to project:", project_id);
    console.log("New item:", newItem);

     if (!newItem._id) {
      newItem._id = new ObjectId(); 
    }

    const project = await collection.findOne({ _id: new ObjectId(project_id) });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

     const result = await collection.updateOne(
      { _id: new ObjectId(project_id) },
      { $push: { items: newItem } }
    );
  
    if (result.modifiedCount === 1) {
      console.log("Update result:", result);
      res.status(200).json({ message: 'Item added successfully api', newItem });
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error('Error in addItemToProject:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});

app.patch('/updateItemDoneProjects/:project_id/:item_id', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');
    const project_id = req.params.project_id;
    const item_id = req.params.item_id;
    const done = req.body.done;

    console.log("Done item to project:", project_id);
    console.log("Done item:", item_id);

    const result = await collection.updateOne(
      { _id: new ObjectId(project_id), "items._id": new ObjectId(item_id) },
      { $set: { "items.$.done": done } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: 'Item updated successfully' });
    } else {
      res.status(404).json({ message: 'Item or project not found' });
    }
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteItemFromProject/:project_id/:item_index', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');
    const project_id = req.params.project_id;
    const item_index = parseInt(req.params.item_index);

    const project = await collection.findOne({ _id: new ObjectId(project_id) });

    if (project) {
      if (item_index >= 0 && item_index < project.items.length) {
        project.items.splice(item_index, 1);

        const result = await collection.updateOne(
          { _id: new ObjectId(project_id) },
          { $set: { items: project.items } }
        );
        res.status(200).json({ message: 'Item deleted successfully' });
      } else {
        res.status(400).json({ message: 'Invalid item index' });
      }
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error('Error in deleteItemFromProject:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  finally {
    await client.close();
  }
});


app.post('/shareProject/:projectId', (req, res, next) => $thinkpink.verifyToken(req, res, next, ['thinkpink-api']), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId; 
    const { email } = req.body;

    console.log(`Starting project share for projectId: ${projectId} by userId: ${userId} to email: ${email}`);

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('projects');

    // Find the project owned by the current user
    const project = await collection.findOne({ _id: new ObjectId(projectId), userId });

    if (!project) {
      console.log(`Project not found or unauthorized: ${projectId}`);
      return res.status(403).json({ message: 'Not authorized to share this project' });
    }

    console.log(`Project found: ${project.title} (ID: ${projectId})`);

    if (!Array.isArray(project.sharedWith)) {
      project.sharedWith = [];
    }

    //Find the user ID by email using the Keycloak Admin API
    const userToShareWith = await findUserIdByEmail(email);

    console.log(`User to share with: ${userToShareWith.email} (ID: ${userToShareWith.id})`);

    // Update the project to add the shared user
    const sharedUser = { userId: userToShareWith.id, email: userToShareWith.email };
    const alreadyShared = project.sharedWith.some(u => u.userId === userToShareWith.id);

    if (!alreadyShared) {
      const updateResult = await collection.updateOne(
        { _id: new ObjectId(projectId) },
        { $push: { sharedWith: sharedUser } }
      );
      console.log(`User ${userToShareWith.email} added to shared list for project: ${project.title}`);

      if (updateResult.modifiedCount === 1) {
        return res.status(200).json({ message: 'Project shared successfully', sharedWith: project.sharedWith.concat(sharedUser) });
      } else {
        return res.status(500).json({ message: 'Failed to update the project' });
      }
    } else {
      console.log(`User ${userToShareWith.email} is already shared with the project`);
      return res.status(200).json({ message: 'User is already shared', sharedWith: project.sharedWith });
    }

  } catch (error) {
    console.error('Error in shareProject:', error.message || error);
    res.status(500).json({ message: 'Internal server error', error: error.message || error });
  } finally {
    await client.close(); 
  }
});





const API_PORT = process.env.API_PORT || 3000;
app.listen(API_PORT, () => console.log(`Express API listening on port ${API_PORT}`));

