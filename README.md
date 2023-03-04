# Status Backend API

> Status is a social media project that is built in React (frontend) and Node.js (backend).  
> It also uses a NOSQL cloud database - MongoDB.  
> This repository contains the backend part of the code.  
  
  
This API currently contains full support for:
- Creating accounts (register and login)
- Publishing posts (with image attachments)
- Publishing comments under posts
- Liking posts and comments
- Following users
- Searching through accounts
- Showing other profiles (accounts)
- Changing the account settings

It also has a partial support for:
- Showing the "home page" feed (recent posts)
- Reporting (user support)
- ...

## Documentation

- All API calls in this app go through the "post" request method.  
- Every request must have a header 'Content-Type' set to 'application/json', and every request's body must be sent in the JSON format.  
- Every response is also sent back in the JSON format.  
- All data is saved onto the cloud database except user avatars and post attachments. They are saved into the '/public' folder.  

The documentation is available on: https://ivant04.github.io/status-backend/docs.html


## Setting up

If you want to run this code you need to:
- Save the code into a folder on your computer
- Install Node.js (v16 or newer)
- Run "npm install" inside the folder where you saved the code
- Create a MongoDB cluster (https://www.mongodb.com/) and set up Network access IP
- Add the MongoDB cluster access credentials into the .env file
- Run the server with "npm start"