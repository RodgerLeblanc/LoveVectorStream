# LoveVectorStream
Vector watch stream that propagate love all around the world!

Share a love message to the world. Get thousands love messages back in return!

Make it short and sweet. We encourage you to use your native language, and be creative!

Requirements :</br>
1) Create an account on Cloudant.com, their free tier will not charge you for the first 50$/month.</br>
2) In Cloudant dashboard, create a new database and name it what you want.</br>
3) In your database permissions in Cloudant dashboard, create a new API key and take note of the key and password. Give _reader and _writer permissions to this API key.</br>
4) Create a developer account on developer.vectorwatch.com</br>
5) Create a new stream and name it what you want.</br>
6) Copy paste all code in Love.js from this repository to your stream code.</br>
7) Change <code>var cloudantUrl = 'your_own_cloudant_database_url' + process.env.STREAM_UUID;
</code> with your own database url.</br>
8) Change <code>apiKeyUser</code> and <code>apiKeyPassword</code> with the API key and password you noted at step 3.</br>
9) In VectorWatch online stream builder, take note of your stream UUID shown in the URL.</br>
10) In Cloudant dashboard, create a new document in your database and name it exactly as your stream UUID.</br>
