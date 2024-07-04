const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const baseURL = 'https://www.ufc-fr.com';

async function fetchPage(url) {
    const response = await axios.get(url);
    return cheerio.load(response.data);
}

async function fetchEvents() {
    const $ = await fetchPage(`${baseURL}/prochain-evenement.html`);
    const events = [];

    $('.card').each((i, elem) => {
        const detailsLink = $(elem).find('a.btn').attr('href');
        if (detailsLink) {
            events.push(`${baseURL}${detailsLink}`);
        }
    });

    const eventsDetails = await Promise.all(events.map(url => fetchEventDetails(url)));
    console.log(eventsDetails);

    fs.writeFile('detailedEvents.json', JSON.stringify(eventsDetails, null, 2), err => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('Successfully written to detailedEvents.json');
        }
    });
}

async function fetchEventDetails(url) {
    const $ = await fetchPage(url);
    const eventDetails = {
        eventTitle: $('.title-header-global-logo').text().trim(),
        eventDate: $('.mt-2').text().trim(),
        eventLocation: $('h4.text-center').text().trim().replace(/[\n\t]/g, ''),
        eventPoster: $('figure img').attr('src'),
        fights: []
    };

    $('#evenement-detail-combat .fight').each((i, elem) => {
        const fighter1 = {
            name: $(elem).find('.nom').first().text().trim(),
            record: $(elem).find('.badge').first().text().trim(),
            ranking: $(elem).find('.badge-ranking').first().text().trim(),
            image: $(elem).find('img').first().attr('src')
        };
        const fighter2 = {
            name: $(elem).find('.nom').last().text().trim(),
            record: $(elem).find('.badge').last().text().trim(),
            ranking: $(elem).find('.badge-ranking').last().text().trim(),
            image: $(elem).find('img').last().attr('src')
        };
        const details = $(elem).find('.typecategorie a').text().trim();
        const fightLink = $(elem).find('.versus_link').attr('href');

        eventDetails.fights.push({ fighter1, fighter2, details, fightLink: baseURL + fightLink });
    });

    return eventDetails;
}

fetchEvents();
