var express = require('express');
var router = express.Router();
var merchantItems = require('../merchant-items.json');
const { Parser } = require('json2csv');
const { default: axios } = require('axios');
var csvToJson = require('csvtojson')
const fs = require('fs');
const { stringify } = require('querystring');

const access_token = 'EAAEm4SrvCE8BAEblZCJsDmwVZBwN1GgemGbJJiQ6VrnpZCfBmnO6CBpnZC8kJlB29FgeOijtRmUxNnBgLMwuB2OcWAnkyqLz63Ek9Sikf4EML2PbK7l6l1ncTCUxsFpl1D7raZA2Ef7GwWkEEQSRlnmRchdlqIlL2ESM03goYBktHXZBheD0Bc'

const catalog_id = '5030236887077668';
const bussiness_id = '2249078045246495'


const alphaImagesBuilder = (filename) => {
  return filename ? `https://www.bulkapparel.com/image/alpha-colors/fashion-wear/${filename}` : null;
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
      ...item.additionalImageLinks.split(',').map(item => item.replace('/styleImages/Images/Color', '/image/fashion-wear').replace('/styleImages/Images/Style', '/image/fashion-wear')),
    ].filter(item => item && item !== image_link).join(",");
    return {
      id: item.id,
      // title: item.title.replace(' '+ item.color, ''),
      title: item.customTitle,
      description: item.description,
      link: item.link,
      image_link,
      // origin_country: item.targetCountry,
      availability: item.availability,
      condition: item.condition,
      google_product_category: item.googleProductCategory,
      // fb_product_category: "",
      gtin: '00' + item.gtin,
      age_group: item.ageGroup.toLowerCase(),
      gender: item.gender.toLowerCase(),
      brand: item.brand,
      color: item.color,
      size: item.size,
      material: item.material,
      additional_image_link,
      product_type: item.productType,
      price: item.price + ' ' + item.currency,
      quantity_to_sell_on_facebook: item.qty,
      // item_group_id: item.itemGroupId,
      item_group_id: (item.brand.replace(/[^A-Z0-9]+/ig, "_") + '_' + item.mpn.toString()).toLowerCase(), // to group all colors and sizes it must be same
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
      url: item.link,
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
      product_type: item.productType,
      price: Math.round(item.price * 100),
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
      return { method: 'CREATE', retailer_id, data }
    }).slice(0, 2)
  })
});


router.get('/items-batch', function (req, res, next) {
  const METHOD = req.query.method || 'UPDATE';
  const page = parseInt(req.query.page) || 1;
  const parsedItems = parsedMerchantJson();

  let chunkItems = [];

  if(req.query.page !== 'all') {
    
      console.log('Page', page);
      console.log('Length', parsedItems.length)
      const unique = [...new Set(parsedItems.map(item => item.item_group_id))]
      console.log('Unique Length', unique.length)
      chunkItems = paginate(parsedItems, 5000, page)
      console.log('Chunk Length', chunkItems.length)

  } else {
    chunkItems = parsedItems;
  }

  res.status(200).json({
    access_token: access_token,
    item_type: "PRODUCT_ITEM",
    allow_upsert: true,
    requests: chunkItems.map(item => {
      const data = item;
      return { method: METHOD, data }
    })
  })
});

router.post('/automatic-items-batch', async function (req, res, next) {
  const METHOD = req.query.method || 'UPDATE';
  const parsedItems = parsedMerchantJson();

  const chunkSize = 5000;
  const chunkCount = Math.ceil(parsedItems.length / chunkSize);

  const promises = []
  const results = []
  const errors = []

  for (i = 1; i <= chunkCount; i++) {

    try {
      const chunkItems = paginate(parsedItems, chunkSize, i);
      const data = {
        access_token: access_token,
        item_type: "PRODUCT_ITEM",
        allow_upsert: true,
        requests: chunkItems.map(item => {
          const data = item;
          return { method: METHOD, data }
        })
      }
      
      const response = await axios.post(`https://graph.facebook.com/v14.0/${catalog_id}/items_batch`, data);

      results.push(response.data);

      console.log(response.data)
    } catch (error) {
      console.log(error.response.data)
      errors.push(error);
    }
   
  }

 
  console.log(chunkCount);

  res.status(200).json({
    message: 'Automatic Item batch successful',
    results: results,
    errors: errors
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


router.post('/csv-to-json', async function (req, res, next) {
  const csv = req.files.csv;

  console.log(csv.tempFilePath)

  const parsedItems = await csvToJson({
    colParser: fields,
  }).fromFile(csv.tempFilePath);

  // console.log(parsedItems)

  // await fs.writeFile('merchant-items.json', JSON.stringify(parsedItems || {}), (error) => {
  //   if (error) console.error(error);
  // });

  res.status(200).json(parsedItems);
});

router.get('/generate-sql', async function(req,res,next) {
  res.status(200).send(['222', '2385', '6102', '4332', '375', '439', '423', '8168', '8169', '3897', '3895', '3898', '9357', '1610', '10101', '173', '1822', '9356', '372', '571', '428', '576', '1697', '395', '557', '415', '39', '551', '817', '148', '6364', '2262', '2715', '2714', '203', '155', '135', '117', '525', '166', '159', '145', '29', '6167', '7584', '6168', '2209', '24', '3870', '1033', '3206', '604', '3209', '3888', '567', '2573', '559', '517', '1441', '6281', '2766', '3612', '123', '1787', '2568', '3212', '3214', '10498', '3215', '6312', '3216', '2213', '388', '2768', '6173', '6174', '2769', '262', '2215', '2003', '540', '75', '12', '3873', '3180', '2707', '21', '3488', '2691', '2694', '237', '258', '245', '865', '520', '3444', '6065', '6534', '2577', '6299', '2561', '431', '91', '28', '422', '16', '543', '2115', '985', '6316', '6314', '6318', '7815', '8437', '2281', '3174', '2484', '2486', '143', '55', '184', '3899', '33', '10', '90', '2282', '94', '1943', '2690', '544', '539', '130', '114', '371', '3900', '4440', '7379', '3461', '6537', '2020', '872', '10476', '6536', '3221', '2217', '1963', '2259', '3896', '2293', '3226', '3227', '3228', '467', '4303', '2024', '32', '809', '2025', '3497', '457', '4471', '2116', '5768', '1682', '3783', '3237', '3102', '6282', '8906', '3246', '10650', '197', '3465', '6891', '7810', '3575', '4837', '146', '526', '2018', '4417', '160', '167', '1363', '1416', '1909', '8198', '2030', '223', '6171', '3092', '2676', '2677', '1846', '3615', '2845', '1917', '2241', '6976', '7216', '2730', '409', '3067', '575', '427', '438', '6237', '10649', '414', '2708', '393', '556', '7269', '7378', '8800', '5996', '399', '383', '6233', '8983', '8608', '403', '8799', '2221', '369', '391', '410', '568', '555', '426', '6717', '6015', '9836', '9837', '3779', '1761', '1758', '1757', '3452', '3456', '1415', '1411', '9136', '1828', '1829', '3644', '1755', '494', '458', '461', '445', '7340']
  .map(styleId => 
    `
  (SELECT 
  products.*,
  merchant.*
  FROM ci_products AS products 
  INNER JOIN ci_google_merchant merchant ON products.gtin = merchant.gtin
  WHERE products.styleID = ${styleId}
  LIMIT 800)
  `).join('UNION'))
})

module.exports = router;


