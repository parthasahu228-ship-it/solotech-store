const express=require("express");
const session=require("express-session");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express(),PORT=process.env.PORT||3000;
app.set("trust proxy",1);
const DB=path.join(__dirname,"store-data.json");
const seed=[
{id:"a1",name:"Wireless Headphones",category:"Electronics",price:1299,oldPrice:1799,stock:20,image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",description:"Wireless audio for everyday listening.",active:true},
{id:"a2",name:"Smart Watch",category:"Electronics",price:1799,oldPrice:2499,stock:15,image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",description:"A smart everyday accessory.",active:true},
{id:"a3",name:"Bluetooth Speaker",category:"Electronics",price:999,oldPrice:1499,stock:25,image:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",description:"Compact speaker for home and travel.",active:true},
{id:"a4",name:"Charging Cable",category:"Accessories",price:199,oldPrice:299,stock:50,image:"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",description:"Everyday charging accessory.",active:true}
];
let pool=process.env.DATABASE_URL?new (require("pg").Pool)({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined,max:5}):null,db={products:seed,orders:[],customers:[]};
function saveFile(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
async function save(){
 if(pool){
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   await c.query("DELETE FROM solotech_products");
   for(const p of db.products) await c.query("INSERT INTO solotech_products(id,data) VALUES($1,$2::jsonb)",[p.id,JSON.stringify(p)]);
   await c.query("DELETE FROM solotech_orders");
   for(const o of db.orders) await c.query("INSERT INTO solotech_orders(id,data) VALUES($1,$2::jsonb)",[o.id,JSON.stringify(o)]);
   await c.query("DELETE FROM solotech_customers");
   for(const u of db.customers) await c.query("INSERT INTO solotech_customers(id,data) VALUES($1,$2::jsonb)",[u.id,JSON.stringify(u)]);
   await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }else saveFile();
}
async function init(){
 db.customers=db.customers||[];
 if(process.env.DATABASE_URL){
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_products(id text PRIMARY KEY,data jsonb NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_orders(id text PRIMARY KEY,data jsonb NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_customers(id text PRIMARY KEY,data jsonb NOT NULL)");
  const p=await pool.query("SELECT data FROM solotech_products ORDER BY id");
  const o=await pool.query("SELECT data FROM solotech_orders ORDER BY id");
  const u=await pool.query("SELECT data FROM solotech_customers ORDER BY id");
  if(p.rows.length) db.products=p.rows.map(x=>x.data);
  else {
   if(fs.existsSync(DB)){try{const old=JSON.parse(fs.readFileSync(DB));if(Array.isArray(old.products))db.products=old.products;if(Array.isArray(old.orders))db.orders=old.orders;}catch{}}
   await save();
  }
  db.orders=o.rows.map(x=>x.data);
  db.customers=u.rows.map(x=>x.data);
  if(!o.rows.length && fs.existsSync(DB)){try{const old=JSON.parse(fs.readFileSync(DB));if(Array.isArray(old.orders))db.orders=old.orders;}catch{};if(db.orders.length)await save();}
  console.log("SOLOTECH database connected");
 }else{
  if(fs.existsSync(DB)){try{db=JSON.parse(fs.readFileSync(DB));}catch{saveFile();}}
  else saveFile();
  console.log("SOLOTECH running with local file storage; DATABASE_URL is not set");
 }
}
app.use(express.json({limit:"1mb"}));
const sessionOptions={name:"solotech.sid",secret:process.env.SESSION_SECRET||"replace-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}};
if(process.env.DATABASE_URL){
 const PgSession=require("connect-pg-simple")(session);
 sessionOptions.store=new PgSession({pool,createTableIfMissing:true,tableName:"solotech_sessions"});
}
app.use(session(sessionOptions));
app.get("/robots.txt",(q,s)=>s.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nSitemap: https://solotech-store.onrender.com/sitemap.xml\n"));
app.get("/sitemap.xml",(q,s)=>s.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://solotech-store.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>'));
app.use(express.static(path.join(__dirname,"public")));
const auth=(q,s,n)=>q.session?.admin?n():s.status(401).json({error:"Admin login required"});
app.get("/api/health",(q,s)=>s.json({ok:true,storage:pool?"postgres":"local"}));

const customerAuth=(q,s,n)=>q.session?.customerId?n():s.status(401).json({error:"Please login to your customer account."});
const hashPassword=p=>{const salt=crypto.randomBytes(16).toString("hex");return salt+":"+crypto.scryptSync(String(p),salt,64).toString("hex");};
const checkPassword=(p,h)=>{try{const [salt,key]=h.split(":");const a=crypto.scryptSync(String(p),salt,64),b=Buffer.from(key,"hex");return b.length===a.length&&crypto.timingSafeEqual(a,b);}catch{return false;}};
const publicCustomer=u=>({id:u.id,name:u.name,phone:u.phone,email:u.email||"",addresses:u.addresses||[],wishlist:u.wishlist||[],cart:u.cart||[]});
app.post("/api/customer/signup",async(q,s)=>{try{const b=q.body||{},phone=String(b.phone||"").trim();if(!b.name||!/^[6-9]\d{9}$/.test(phone)||String(b.password||"").length<6)return s.status(400).json({error:"Enter your name, valid 10-digit mobile number and password (minimum 6 characters)."});if(db.customers.some(u=>u.phone===phone))return s.status(409).json({error:"This mobile number already has an account. Please login."});const u={id:"CU"+Date.now()+crypto.randomBytes(3).toString("hex"),name:String(b.name).trim(),phone,email:String(b.email||"").trim(),passwordHash:hashPassword(b.password),addresses:[],wishlist:[],cart:[],createdAt:new Date().toISOString()};db.customers.push(u);await save();q.session.customerId=u.id;s.status(201).json({ok:true,customer:publicCustomer(u)});}catch(e){console.error(e);s.status(500).json({error:"Could not create account. Please try again."});}});
app.post("/api/customer/login",(q,s)=>{const phone=String(q.body?.phone||"").trim(),u=db.customers.find(x=>x.phone===phone);if(!u||!checkPassword(q.body?.password||"",u.passwordHash))return s.status(401).json({error:"Incorrect mobile number or password."});q.session.customerId=u.id;s.json({ok:true,customer:publicCustomer(u)});});
app.post("/api/customer/logout",(q,s)=>{delete q.session.customerId;s.json({ok:true});});
app.get("/api/customer/me",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u){delete q.session.customerId;return s.status(401).json({error:"Please login."});}s.json({customer:publicCustomer(u)});});
app.put("/api/customer/profile",customerAuth,async(q,s)=>{try{const u=db.customers.find(x=>x.id===q.session.customerId),b=q.body||{};if(!u)return s.sendStatus(401);if(!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||"")))return s.status(400).json({error:"Enter a name and valid 10-digit mobile number."});if(db.customers.some(x=>x.id!==u.id&&x.phone===String(b.phone)))return s.status(409).json({error:"This mobile number is already used by another account."});u.name=String(b.name).trim();u.phone=String(b.phone);u.email=String(b.email||"").trim();if(b.newPassword){if(String(b.newPassword).length<6)return s.status(400).json({error:"New password must be at least 6 characters."});if(!checkPassword(b.currentPassword||"",u.passwordHash))return s.status(400).json({error:"Current password is incorrect."});u.passwordHash=hashPassword(b.newPassword);}await save();s.json({ok:true,customer:publicCustomer(u)});}catch(e){console.error(e);s.status(500).json({error:"Could not update profile."});}});
app.post("/api/customer/addresses",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId),b=q.body||{};if(!u)return s.sendStatus(401);if(!b.label||!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||""))||!b.address||!b.city||!b.state||!/^[0-9]{6}$/.test(String(b.pin||"")))return s.status(400).json({error:"Please complete all address details correctly."});const a={id:"AD"+Date.now()+crypto.randomBytes(2).toString("hex"),label:String(b.label),name:String(b.name),phone:String(b.phone),address:String(b.address),city:String(b.city),state:String(b.state),pin:String(b.pin)};u.addresses=u.addresses||[];u.addresses.push(a);try{await save();s.status(201).json({ok:true,addresses:u.addresses});}catch(e){console.error(e);s.sendStatus(500);}});
app.delete("/api/customer/addresses/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.sendStatus(401);u.addresses=(u.addresses||[]).filter(a=>a.id!==q.params.id);await save();s.json({ok:true,addresses:u.addresses});});
app.get("/api/customer/wishlist",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);s.json(u?.wishlist||[]);});
app.post("/api/customer/wishlist/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId),p=db.products.find(x=>x.id===q.params.id&&x.active);if(!u||!p)return s.sendStatus(404);u.wishlist=u.wishlist||[];if(!u.wishlist.includes(p.id))u.wishlist.push(p.id);await save();s.json({ok:true,wishlist:u.wishlist});});
app.delete("/api/customer/wishlist/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.status(401).json({error:"Please login."});u.wishlist=(u.wishlist||[]).filter(id=>id!==q.params.id);await save();s.json({ok:true,wishlist:u.wishlist});});
app.get("/api/customer/cart",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);s.json(u?.cart||[]);});
app.put("/api/customer/cart",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.sendStatus(401);u.cart=Array.isArray(q.body?.items)?q.body.items.filter(i=>db.products.some(p=>p.id===i.id&&p.active)).map(i=>({id:i.id,qty:Math.max(1,Math.min(10,Number(i.qty)||1))})):[];await save();s.json({ok:true,cart:u.cart});});
app.get("/api/customer/orders",customerAuth,(q,s)=>s.json(db.orders.filter(o=>o.customerId===q.session.customerId)));

app.get("/api/products",(q,s)=>s.json(db.products.filter(p=>p.active)));
app.post("/api/orders",async(q,s)=>{try{
 const b=q.body||{};
 if(!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||""))||!b.address||!b.city||!b.state||!/^[0-9]{6}$/.test(String(b.pin||""))||!Array.isArray(b.items)||!b.items.length)return s.status(400).json({error:"Please enter all delivery details correctly."});
 let items=[],total=0;
 for(const x of b.items){const p=db.products.find(y=>y.id===x.id&&y.active),qty=Math.max(1,Math.min(10,Number(x.qty)||1));if(!p||p.stock<qty)return s.status(400).json({error:"Product stock unavailable. Refresh your cart."});items.push({id:p.id,name:p.name,price:p.price,qty});total+=p.price*qty;}
 items.forEach(i=>db.products.find(p=>p.id===i.id).stock-=i.qty);
 const order={id:"ST"+Date.now(),customerId:q.session?.customerId||null,name:b.name,phone:String(b.phone),address:b.address,city:b.city,state:b.state,pin:String(b.pin),items,total,payment:"Cash on Delivery",status:"New",createdAt:new Date().toISOString()};
 db.orders.unshift(order);if(q.session?.customerId){const u=db.customers.find(x=>x.id===q.session.customerId);if(u)u.cart=[];}await save();s.status(201).json({ok:true,orderId:order.id});
 }catch(e){console.error(e);s.status(500).json({error:"Could not save order. Please try again."});}});
app.post("/api/admin/login",(q,s)=>{if(q.body?.username===process.env.ADMIN_USER&&q.body?.password===process.env.ADMIN_PASSWORD&&process.env.ADMIN_USER&&process.env.ADMIN_PASSWORD){q.session.admin=true;return s.json({ok:true});}s.status(401).json({error:"Incorrect login."});});
app.post("/api/admin/logout",(q,s)=>q.session.destroy(()=>s.json({ok:true})));
app.get("/api/admin/me",(q,s)=>s.json({loggedIn:!!q.session?.admin}));
app.get("/api/admin/products",auth,(q,s)=>s.json(db.products));
app.post("/api/admin/products",auth,async(q,s)=>{try{const b=q.body||{};if(!b.name||!b.category||Number(b.price)<=0)return s.status(400).json({error:"Name, category and price required"});const p={id:"p"+Date.now(),name:b.name,category:b.category,price:Number(b.price),oldPrice:Number(b.oldPrice)||0,stock:Number(b.stock)||0,image:b.image||"",description:b.description||"",active:true};db.products.unshift(p);await save();s.status(201).json(p);}catch(e){console.error(e);s.sendStatus(500);}});
app.put("/api/admin/products/:id",auth,async(q,s)=>{try{const p=db.products.find(x=>x.id===q.params.id);if(!p)return s.sendStatus(404);Object.assign(p,q.body);await save();s.json(p);}catch(e){console.error(e);s.sendStatus(500);}});
app.delete("/api/admin/products/:id",auth,async(q,s)=>{try{db.products=db.products.filter(x=>x.id!==q.params.id);await save();s.json({ok:true});}catch(e){console.error(e);s.sendStatus(500);}});
app.get("/api/admin/orders",auth,(q,s)=>s.json(db.orders));
app.patch("/api/admin/orders/:id",auth,async(q,s)=>{try{const o=db.orders.find(x=>x.id===q.params.id);if(!o)return s.sendStatus(404);if(!["New","Confirmed","Packed","Shipped","Delivered","Cancelled"].includes(q.body.status))return s.sendStatus(400);o.status=q.body.status;await save();s.json(o);}catch(e){console.error(e);s.sendStatus(500);}});
init().then(()=>app.listen(PORT,()=>console.log("SOLOTECH listening on "+PORT))).catch(e=>{console.error("Startup failed",e);process.exit(1);});
