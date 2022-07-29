var express = require('express');
var router = express.Router();
var merchantItems = require('../merchant-items.json');
const { Parser } = require('json2csv');
const { default: axios } = require('axios');

const access_token = 'EAAEm4SrvCE8BANnwjfFy5xZCzCXVTRBLLLn8b9S94c7hKtaN4hyXbwDiZB3ZChmCwkOsoHTTjHX6rDLzhPVPpcyQo9RvtA8inU19nLVoIU62tsuZBWs9vu8Lpvwxp4VtnAByETux3ZAwtitEQA4oP0DozyZAd5HmiJZCyXguTG6SjDz0ucDfLaZC'

const catalog_id = '427985606043365';
const bussiness_id = '2249078045246495'


const alphaImagesBuilder = (filename) => {
  return filename ? `https://sl7.bulkapparel.com/image/alpha-colors/fashion-wear/${filename}` : null;
}


const parsedMerchantJson = () => {
  // return merchantItems.slice(0, 5000).map(item => {
  return merchantItems.map(item => {
    const frontAlphaImageLink = alphaImagesBuilder(item.alphaFrontImage);
    const sideAlphaImageLink = alphaImagesBuilder(item.alphaSideImage);
    const backAlphaImageLink = alphaImagesBuilder(item.alphaBackImage);
    const image_link = frontAlphaImageLink || item.imageLink
    const additional_image_link = [
       frontAlphaImageLink, 
       sideAlphaImageLink, 
       backAlphaImageLink, 
       item.imageLink,
      ...item.additionalImageLinks.split(',').map(item => item.replace('/styleImages/Images/Color', '/image/fashion-wear')),
    ].filter(item=> item && item !== image_link).join(",");
    return {
      id: item.id,
      title: item.title.replace(' '+ item.color, ''),
      description: item.description,
      link:item.link,
      image_link,
      // origin_country: item.targetCountry,
      availability: item.availability,
      condition: item.condition,
      google_product_category: item.googleProductCategory,
      // fb_product_category: "",
      gtin: '00'+item.gtin,
      age_group: item.ageGroup.toLowerCase(),
      gender: item.gender.toLowerCase(),
      brand: item.brand,
      color: item.color,
      size: item.size,
      material: item.material,
      additional_image_link,
      product_type: item.productType ,
      price: item.price + ' ' + item.currency,
      quantity_to_sell_on_facebook: item.qty,
      // item_group_id: item.itemGroupId,
      item_group_id: item.mpn.toString(), // to group all colors and sizes it must be same
      "custom_label_0": item.customLabel0,
			"custom_label_1": item.customLabel1,
			"custom_label_2": item.customLabel2,
			"custom_label_3": item.customLabel3,
			"custom_label_4": item.customLabel4,
    }
  })

} 

function paginate(array, page_size, page_number) {
  return array.slice((page_number - 1) * page_size, page_number * page_size);
}



/* GET home page. */
router.get('/batch', function (req, res, next) {
  const parsedItems = merchantItems.map(item => {
    return {
      id: item.id,
      name: item.title,
      description: item.description,
      url:item.link,
      image_url: item.imageLink,
      // origin_country: item.targetCountry,
      availability: item.availability,
      condition: item.condition,
      category: item.googleProductCategory,
      // google_product_category: item.googleProductCategory,
      // fb_product_category: "",
      gtin: item.gtin,
      age_group: item.ageGroup.toLowerCase(),
      gender: item.gender.toLowerCase(),
      brand: item.brand,
      color: item.color,
      size: item.size,
      material: item.material,
      additional_image_urls: item.additionalImageLinks.split(',').map(item => item.replace('/styleImages/Images/Color', '/image/fashion-wear/')),
      product_type: item.productType ,
      price: Math.round (item.price * 100),
      currency: item.currency,
      retailer_product_group_id: item.itemGroupId,
      "custom_label_0": item.customLabel0,
			"custom_label_1": item.customLabel1,
			"custom_label_2": item.customLabel2,
			"custom_label_3": item.customLabel3,
			"custom_label_4": item.customLabel4,
    }
  })



  res.status(200).json({
    access_token: "EAAEm4SrvCE8BAN1NQ9C9VpdJwmPJseIHGotkIE7gJbZAbZB00RBc5YLQMHdG0tiwg1ILUzXYraSrJkcilMwsX6QVuHXek2aHIKK5gISMjemMCFwcCsJwxUCHsFQbgzt3xx33YhYz3r3AR7w0K6qboicaPBMWlykQAkc5t4Wq8VyrocUkiZC",
    item_type: "PRODUCT_ITEM",
    allow_upsert: true,
    requests: parsedItems.map(item => {
      const data = item;
      let retailer_id = item.id
      delete data.id;
      return {method: 'CREATE', retailer_id, data  }
    }).slice(0,2)
  })
});


router.get('/items-batch', function (req, res, next) {
  const METHOD = req.query.method || 'UPDATE';
  const page = parseInt(req.query.page) || 1;
  const parsedItems = parsedMerchantJson();

  console.log('Page', page);

  console.log('Length',parsedItems.length)
  
  const unique = [...new Set(parsedItems.map(item => item.item_group_id))]

  console.log('Unique Length', unique.length)

  const chunkItems = paginate(parsedItems, 5000, page)
  
  console.log('Chunk Length', chunkItems.length)

  res.status(200).json({
    access_token: access_token,
    item_type: "PRODUCT_ITEM",
    allow_upsert: true,
    requests: chunkItems.map(item => {
      const data = item;
      return {method: METHOD, data  }
    })
  })
});

router.get('/automatic-items-batch', function (req, res, next) {
  const METHOD = req.query.method || 'UPDATE';
  const parsedItems = parsedMerchantJson();

  const chunkSize = 5000;
  const chunkCount = parsedItems / chunkSize;
  
  const promises = [] 
  const results = []
  
  
  for (i = 1; i <= chunkCount; i++) {
    const chunkItems = paginate(parsedItems, chunkSize, i);
    const data = {
      access_token: access_token,
      item_type: "PRODUCT_ITEM",
      allow_upsert: true,
      requests: chunkItems.map(item => {
        const data = item;
        return {method: METHOD, data  }
      })
    }
    promises.push(
      axios.post(`https://graph.facebook.com/v14.0/${catalog_id}/items_batch`, data).then((response)=> results.push(response) )
    )
  }
  
  
  const data = await Promise.all(promises);
  
  res.status(200).json({
    message: 'Automatic Item batch successful',
    results,
  })
});

const fields = [
  'id',
  'title',
  'description',
  'link',
  'image_link',
  'availability',
  'condition',
  'google_product_category',
  'age_group',
  'gender',
  'brand',
  'color',
  'size',
  'material',
  'additional_image_link',
  'product_type',
  'price',
  'quantity_to_sell_on_facebook',
  'item_group_id',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4'
];
const opts = { fields };

router.get('/plain-items-batch', function (req, res, next) {
  const parsedItems = parsedMerchantJson();
  
  try {
    const parser = new Parser(opts);
    const csv = parser.parse(parsedItems);
    res.attachment('filename.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
  }
});



module.exports = router;
