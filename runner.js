const { ObjectId } = require('mongodb'); 
const dbUrl = 'mongodb://localhost:27017/thinkpink'; 
const { MongoClient } = require('mongodb'); 
const client = new MongoClient('mongodb://localhost:27017/thinkpink');


//Update done for Routines

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

//Remove events from Done when they have passed 30 days

async function removeOldEvents() {
    try {

 	console.log("Removing events...");

	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString();

	const result = await collection.updateMany({ date: { $lt: thirtyDaysAgoString }}, { $set: { noShow: true } });

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

        //For Greece

        const startOfTodayUTC = new Date();
        startOfTodayUTC.setUTCDate(startOfTodayUTC.getUTCDate() - 1); 
        startOfTodayUTC.setUTCHours(21, 0, 0, 0); // 21:00 UTC is midnight in Greece
        const todayString = startOfTodayUTC.toISOString();
        console.log("Today's date:", todayString);

        const startOfTomorrowUTC = new Date(startOfTodayUTC);
        startOfTomorrowUTC.setUTCDate(startOfTomorrowUTC.getUTCDate() + 1); 
        const tomorrowString = startOfTomorrowUTC.toISOString();
        console.log("Tomorrow's date:", tomorrowString);


        // Fetch events for today
        const events = await collection.find({
            date: { $gte: todayString, $lt: tomorrowString },
            type: { $ne: 'Routine' },
        }).toArray();
        console.log(`Found ${events} for today .`);

        // Process each event and create a new one based on the frequency
        for (const event of events) {
            let newDate;

            console.log(`Processing event: ${event._id}, Frequency: ${event.frequency}`);

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
                    const customDays = parseInt(event.frequency2, 10);
                    if (!isNaN(customDays)) {
                        newDate = new Date(event.date);
                        newDate.setDate(newDate.getDate() + customDays);
                    } else {
                        console.warn(`Event ${event._id} has 'Custom' frequency but no 'frequency2'.`);
                        continue;
                    }
                    break;
                default:
                    console.warn(`Event ${event._id} has an unrecognized frequency: ${event.frequency}`);
                    continue;
            }

            const newDateString = newDate.toISOString();
            console.log(`New date for event ${event._id}:`, newDateString);

            // Create a new event with the updated date
            const newEvent = {
                ...event,
                _id: new ObjectId(), 
                date: newDateString,
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