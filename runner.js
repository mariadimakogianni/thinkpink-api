const { ObjectId } = require('mongodb'); 
const dbUrl = 'mongodb://localhost:27017/thinkpink'; 
const { MongoClient } = require('mongodb'); 
const client = new MongoClient('mongodb://localhost:27017/thinkpink');

async function updateEvents() { 
 try {

 	console.log("Reseting routines...");

	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	const result = await collection.updateMany({ type: 'Routine', done: true }, { $set: { done: false } });

	console.log(`${result.matchedCount} document(s) matched the filter`);
	console.log(`${result.modifiedCount} document(s) were updated`);

	} catch (err) {
        console.error('Error updating events:', err);
        return 1;
    } finally {
        await client.close();
    }
    console.log("DONE!");
    return 0;
}

async function removeOldEvents() {
    try {

 	console.log("Removing events...");

	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const result = await collection.updateMany({ date: { $lt: thirtyDaysAgo }, done: true }, { $set: { noShow: true } });

	console.log(`${result.matchedCount} document(s) matched the filter`);
	console.log(`${result.modifiedCount} document(s) were updated`);

	} catch (err) {
        console.error('Error updating events:', err);
        return 1;
    } finally {
        await client.close();
    }
    console.log("DONE!");
    return 0;
}

async function updateFrequency() {
    try {
        console.log("Updating frequencies...");
        await client.connect();
        const db = client.db('thinkpink');
        const collection = db.collection('events');

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); 

        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        // Fetch events for today
        const events = await collection.find({
            date: { $gte: today, $lt: tomorrow },
            type: { $ne: 'Routine' },
            done: false
        }).toArray();

        // Process each event and create a new one based on the frequency
        for (const event of events) {
            let newDate;

            // Calculate the new date based on the frequency
            switch (event.frequency) {
                case 'Every Day':
                    newDate = new Date(event.date);
                    newDate.setDate(newDate.getDate() + 1);
                    break;
                case 'Every Week':
                    newDate = new Date(event.date);
                    newDate.setDate(newDate.getDate() + 7);
                    break;
                case 'Every Month':
                    newDate = new Date(event.date);
                    newDate.setMonth(newDate.getMonth() + 1);
                    break;
                case 'Every Year':
                    newDate = new Date(event.date);
                    newDate.setFullYear(newDate.getFullYear() + 1);
                    break;
                case 'Custom':
                    if (event.frequency2) {
                        newDate = new Date(event.date);
                        newDate.setDate(newDate.getDate() + event.frequency2);
                    } else {
                        console.warn(`Event ${event._id} has 'Custom' frequency but no 'frequency2' value.`);
                        continue;
                    }
                    break;
                default:
                    console.warn(`Event ${event._id} has an unrecognized frequency: ${event.frequency}`);
                    continue;
            }

            // Create a new event with the updated date and other attributes
            const newEvent = {
                ...event,
                _id: new ObjectId(), 
                date: newDate,
                done: false, 
            };

            // Insert the new event into the collection
            await collection.insertOne(newEvent);
            console.log(`Created new event with ID: ${newEvent._id}`);
        }

        console.log(`Processed ${events.length} event(s) for frequency updates.`);
    } catch (err) {
        console.error('Error updating events:', err);
        return 1;
    } finally {
        // Close the connection
        await client.close();
    }
    console.log("DONE!");
    return 0;
}

async function main(){
	await updateEvents().catch(console.error);
	await removeOldEvents().catch(console.error);
	await updateFrequency().catch(console.error);
}

main(process.argv);