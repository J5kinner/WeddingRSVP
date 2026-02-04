const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertFolder(inputFolder, outputFolder, quality = 80, maxWidth = null) {
    // console.log(`\nConverting ${inputFolder} to ${outputFolder}...`);

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const files = fs.readdirSync(inputFolder)
        .filter(file => file.endsWith('.png'))
        .sort();

    // console.log(`Found ${files.length} PNG files`);

    let totalOriginalSize = 0;
    let totalNewSize = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file.replace('.png', '.webp'));

        const originalStats = fs.statSync(inputPath);
        totalOriginalSize += originalStats.size;

        let pipeline = sharp(inputPath);

        if (maxWidth) {
            pipeline = pipeline.resize(maxWidth, null, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        await pipeline
            .webp({ quality })
            .toFile(outputPath);

        const newStats = fs.statSync(outputPath);
        totalNewSize += newStats.size;

        if ((i + 1) % 50 === 0 || i === files.length - 1) {
            const progress = ((i + 1) / files.length * 100).toFixed(1);
            const savedSoFar = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
            // console.log(`Progress: ${i + 1}/${files.length} (${progress}%) - Saved ${savedSoFar}% so far`);
        }
    }

    const savedPercentage = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    const originalMB = (totalOriginalSize / 1024 / 1024).toFixed(2);
    const newMB = (totalNewSize / 1024 / 1024).toFixed(2);

    /*
    console.log(`\n✅ Completed ${inputFolder}:`);
    console.log(`   Original: ${originalMB} MB`);
    console.log(`   New: ${newMB} MB`);
    console.log(`   Saved: ${savedPercentage}%\n`);
    */

    return { originalMB, newMB, savedPercentage };
}

async function main() {
    const publicDir = path.join(__dirname, '..', 'public');

    // console.log('🚀 Starting image conversion to WebP...\n');
    // console.log('This will create optimized versions for different devices:\n');

    const conversions = [
        // Mobile - smallest, lowest quality for slow connections
        {
            input: path.join(publicDir, 'mob_smaller'),
            output: path.join(publicDir, 'frames_mobile'),
            quality: 75,
            maxWidth: 800,
            description: 'Mobile (800px, quality 75)'
        },
        // Tablet - medium size and quality
        {
            input: path.join(publicDir, 'mob_pics'),
            output: path.join(publicDir, 'frames_tablet'),
            quality: 80,
            maxWidth: 1200,
            description: 'Tablet (1200px, quality 80)'
        },
        // Desktop - full size, high quality
        {
            input: path.join(publicDir, 'web_pics'),
            output: path.join(publicDir, 'frames_desktop'),
            quality: 85,
            maxWidth: 1920,
            description: 'Desktop (1920px, quality 85)'
        }
    ];

    const results = [];

    for (const config of conversions) {
        if (fs.existsSync(config.input)) {
            // console.log(`📱 ${config.description}`);
            const result = await convertFolder(
                config.input,
                config.output,
                config.quality,
                config.maxWidth
            );
            results.push({ ...config, ...result });
        } else {
            // console.log(`⚠️  Skipping ${config.description} - folder not found: ${config.input}\n`);
        }
    }

    /*
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    */

    results.forEach(r => {
        /*
        console.log(`\n${r.description}:`);
        console.log(`  ${r.originalMB} MB → ${r.newMB} MB (saved ${r.savedPercentage}%)`);
        */
    });

    const totalOriginal = results.reduce((sum, r) => sum + parseFloat(r.originalMB), 0);
    const totalNew = results.reduce((sum, r) => sum + parseFloat(r.newMB), 0);
    const totalSaved = ((1 - totalNew / totalOriginal) * 100).toFixed(1);

    /*
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TOTAL: ${totalOriginal.toFixed(2)} MB → ${totalNew.toFixed(2)} MB`);
    console.log(`SAVED: ${totalSaved}%`);
    console.log('='.repeat(60) + '\n');
    */
}

main().catch(console.error);
