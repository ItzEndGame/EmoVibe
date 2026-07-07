// Fallback song IDs shown when the live Spotify recommendation API
// fails or returns no results, keyed by emotion -> language.
// Each id is a Spotify track id; batches of 4 are grouped for the
// 'refresh' and 'load more' flows in MainApp.

const dummyData = {
    happy: {
      english: [
      { id: '0RiRZpuVRbi7oqRdSMwhQY' },
      { id: '1xznGGDReH1oQq0xzbwXa3' },
      { id: '7BqHUALzNBTanL6OvsqmC1' },
      { id: '45Egmo7icyopuzJN0oMEdk' },
      { id: '5oID3Qj3tTCZEH9eo0snxm' },
      { id: '3PfIrDoz19wz7qK7tYeu62' },
      { id: '7qiZfU4dY1lWllzX7mPBI3'},
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '2FubKMjTFEGN09nknQUbC8' },
      { id: '5fr7VBuNTiXAq4rH1e3v3q' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    punjabi: [
      { id: '2mwBSO58y92EYmEFpDfmS7' },
      { id: '3Oe3VdPn6rAueriQvFhCBA' },
      { id: '1zqANJCtkCOzGR7beikLd6' },
      { id: '3F0I9AkbRwz12yz7Hxn0bF' },
      { id: '7q7eYVerltlW2sYBuga6Mj' },
      { id: '39ujbBjTwwqUFySaCYDMMT'  },
      { id: '1iZLpuGMr4tn1F5bZu32Kb' },
      { id: '6mdLX10dvBb7rGYbMXpKzz' },
      // Next 4 songs (refresh 1)
      { id: '3f8t2LZGYtdNQh8SNEiZcG' },
      { id: '4t77OsiudWy4timV32lPa2' },
      { id: '1QZRCi2Z1DQQaR6bGAzhtN' },
      { id: '4cQxBfdD5nNJaLcPIY3EcK' },
      // Next 4 songs (refresh 2)
      { id: '2Wu9PNpLUCBl3W1GaPqkhl' },
      { id: '32LKwbmh6yVsWoRRF8DIvf' },
      { id: '72vuBPMhwFNlSYpTSf6fVD' },
      { id: '1tEto4JrqNmBZFH5uAiYqb' }
    ],
    hindi: [
      { id: '6k3XXCE1ZzwevQlxf8dNaw' },
      { id: '65dt1vedDHPOCCPS3mVhtN' },
      { id: '0qPoQiQIhgyMaP7X78hxri' },
      { id: '7xxxQG1BupSnOBo4qId9kl' },
      { id: '0eLtIxPRNJfsmehITZ1qaJ' },
      { id: '5PUXKVVVQ74C3gl5vKy9Li' },
      { id: '3x822BpQYSFMIB7P3uiJN0'  },
      { id: '7eQl3Yqv35ioqUfveKHitE' },
      // Next 4 songs (refresh 1)
      { id: '18YHbIhrleUkKKj2DvEp79' },
      { id: '2tjWCe2W7sgvS3C8NHcdtI' },
      { id: '3jyqXdAjwqO3gFtjnYrbq9' },
      { id: '0gPgdRfB4jdGrlyXS0Vx78' },
      // Next 4 songs (refresh 2)
      { id: '0GQngE2rOYvlKwEQjTAsP8' },
      { id: '1gwO79MdYdumgIjxq8eCxB' },
      { id: '0EH7sgeiFqDa3eS7ieW2zs' },
      { id: '2YNgcIiD73XsXFNM3UuxlM' }
],
      french: [
      { id: '0RE4crnT3jRms1xxVlEZx2' },
      { id: '1Bhm5HNO1cq8olDbBmokyL' },
      { id: '6zvHwijlnwqjS6d46yAffi' },
      { id: '65uoaqX5qcjXZRheAj1qQT' },
      { id: '4lsOsGMzO1yCjGVucoWOZ1' },
      { id: '18ZX6YaDSOopXPRvfIh8DM' },
      { id: '4VWbPQUPvLes814r6T11Jz'  },
      { id: '1zyUz3eZ3sytdaR9lfW17q' },
      // Next 4 songs (refresh 1)
      { id: '6nGeLlakfzlBcFdZXteDq7' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '6JFw2mbcNfoFXnrk6AxGK6' },
      { id: '7arCRGABaKdEFvGa3gCM9d' },
      // Next 4 songs (refresh 2)
      { id: '7sKDftgGirHWTVFMtJoDoh' },
      { id: '1MqzIgGsHP4cNjPboevsfq' },
      { id: '1R1deVa4LzVxzgFIpvS2O3' },
      { id: '5cAzaNbU7AEgfsJgL9sbtX' }
],
      spanish: [
      { id: '2AY1UAimvTqjJC8vDJsOyy' },
      { id: '4w8niZpiMy6qz1mntFA5uM' },
      { id: '4ipnJyDU3Lq15qBAYNqlqK' },
      { id: '6habFhsOp2NvshLv26DqMb' },
      { id: '6Za3190Sbw39BBC77WSS1C' },
      { id: '2ijef6ni2amuunRoKTlgww' },
      { id: '4QtiVmuA88tPQiCOHZuQ5b'  },
      { id: '48fKgzfvTU4U7eyRtIYaHP' },
      // Next 4 songs (refresh 1)
      { id: '5w9c2J52mkdntKOmRLeM2m' },
      { id: '63aj87TQG6F3RVO5nbG2VQ' },
      { id: '079Ey5uxL04AKPQgVQwx5h' },
      { id: '6IPNp9PfaEqrzotY47TIWy' },
      // Next 4 songs (refresh 2)
      { id: '6DRGwsUFQrNerxRexK7KMB' },
      { id: '5YoITs1m0q8UOQ4AW7N5ga' },
      { id: '5bKDKo9lhFvTQR517vQuSH' },
      { id: '0gxbA4bZN8KyNHsCUfNvyr' }
    ],
      korean: [
      { id: '02sy7FAs8dkDNYsHp4Ul3f' },
      { id: '5H1sKFMzDeMtXwND3V6hRY' },
      { id: '3XYRV7ZSHqIRDG87DKTtry' },
      { id: '3zhbXKFjUDw40pTYyCgt1Y' },
      { id: '6u0pZe0Uv7GBR0iKptfWRf' },
      { id: '6qAzAmPBUpGrk7XADZHR5k' },
      { id: '3ejAkJLWQSEJDqDXxK3efB'  },
      { id: '1R0hxCA5R7z5TiaXBZR7Mf' },
      // Next 4 songs (refresh 1)
      { id: '1t2qYCAjUAoGfeFeoBlK51' },
      { id: '5mpWGq83n0sIgGRopGk5QZ' },
      { id: '5KfbFCacFuNJGdK2zvovcF' },
      { id: '0dnkOK5hGUCmIJ7FDF0yHz' },
      // Next 4 songs (refresh 2)
      { id: '2zrhoHlFKxFTRF5aMyxMoQ' },
      { id: '0jFHMDRXxKaREor3hBEEST' },
      { id: '69BIczdH6QMnFx7dsSssN8' },
      { id: '2gYj9lubBorOPIVWsTXugG' }
    ],

      japanese: [
      { id: '2BHj31ufdEqVK5CkYDp9mA' },
      { id: '49h5Aav6yn1o1ACGyovDdZ' },
      { id: '348NF6vX0Yh22xvH0EZEro' },
      { id: '2BBIUV8wIBbqc7HXObzdgH' },
      { id: '3CeUMk1K4RPOpyzxn7JKZV' },
      { id: '3zeV6b2FMFsLHopzHHnS6J'  },
      { id: '7GxUPZNxNPvDToM4FkXE6G' },
      { id: '172zA5Yn0YzayQWvEJuGAm' },
      // Next 4 songs (refresh 1)
      { id: '7rU6Iebxzlvqy5t857bKFq' },
      { id: '4HYDnQZcpfpsttuoaY9gsp' },
      { id: '4FlDhqXIaF6wiT7ssRTACB' },
      { id: '0zoGVO4bQXG8U6ChKwNgeg' },
      // Next 4 songs (refresh 2)
      { id: '5WTCHYg9G27e9e5HFKGdd1' },
      { id: '4rvtqOGyTPZJwWtVTNdZbu' },
      { id: '5RbMlPFL4gVyEHW2lEOuzG' },
      { id: '3OdkC5pG8vc26S26qHyBo8' }
    ]
      
  },
    sad: {
      english: [
      { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }    
    ],
    hindi: [
    { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    punjabi: [
    { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    french: [
      { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    spanish: [
      { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    korean: [
      { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    japanese: [
      { id: '4kflIGfjdZJW4ot2ioixTB' },
      { id: '7LVHVU3tWfcxj5aiPFEW4Q' },
      { id: '0IF0HlkwzIpvSCI6XCw3RM' },
      { id: '21FX3Jb9azH08Nz0GKRQ3c' },
      { id: '2qxmye6gAegTMjLKEBoR3d' },
      { id: '6FZDfxM3a3UCqtzo5pxSLZ' },
      { id: '1v1oIWf2Xgh54kIWuKsDf6' },
      { id: '1J14CdDAvBTE1AJYUOwl6C' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ]
  },
    angry: {
      english: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      hindi: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
 ],
      punjabi: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
   ],
      french: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      spanish: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      korean: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      japanese: [
      { id: '60a0Rd6pjrkxjPbaKzXjfq'},
      { id: '2bL2gyO6kBdLkNSkxXNh6x'},
      { id: '5ghIJDpPoe3CfHMGu71E6T'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      { id: '2uqxsofWmgRT0ekghgy3ln'},
      { id: '4De0GQSQv4Hqnmd4fdMyAY'},
      { id: '1pfvzAelLOdPS0CAULo77c'},
      { id: '4fouWK6XVHhzl78KzQ1UjL'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
]
  },
    neutral: {
      english: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      hindi: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      punjabi:[
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      french: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
      spanish: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
   ],
      korean: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
   ],
   japanese: [
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      { id: '6AI3ezQ4o3HUoP6Dhudph3'},
      { id: '53CJANUxooaqGOtdsBTh7O'},
      { id: '02MWAaffLxlfxAUY7c5dvx'},
      { id: '5vNRhkKd0yEAg8suGBpjeY'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
   ]      
  },
    surprise: {
      english: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    hindi: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    punjabi: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    french: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    spanish: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    korean: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    japanese: [
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      { id: '3e9HZxeyfWwjeyPAMmWSSQ'},
      { id: '6964mJTlD7fnWYdxuDJwyO'},
      { id: '04c0sgiXUEBi0EtCFHZgof'},
      { id: '1kUyOJb3fzUo8r0OCz5SQ' },
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ]
  },
    fear: {
      english: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    hindi: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    punjabi: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    french: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    spanish: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    korean: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    japanese:[
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ]
  },
    disgust: {
      english: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    hindi: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    punjabi: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    french: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    spanish: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    korean: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ],
    japanese: [
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      { id: '4SSnFejRGlZikf02HLewEF'},
      { id: '1882UlTYVk8VOFzM6eANoo'},
      { id: '5ZLUm9eab8y3tqQ1OhQSHI'},
      { id: '1zB4vmk8tFRmM9UULNzbLB'},
      // Next 4 songs (refresh 1)
      { id: '60nZcImufyMA1MKQY3dcCH' },
      { id: '0pqnGHJpmpxLKifKRmU6WP' },
      { id: '5hslUAKq9I9CG2bAulFkHN' },
      { id: '32OlwWuMpZ6b0aN2RZOeMS' },
      // Next 4 songs (refresh 2)
      { id: '3AJwUDP919kvQ9QcozQPxg' },
      { id: '5ygDXis42ncn6kYG14lEVG' },
      { id: '6dBUzqjtbnIa1TwYbyw5CM' },
      { id: '2Foc5Q5nqNiosCNqttzHof' }
    ]
  }
  };

/**
 * Returns the fallback (dummy) track list for a given emotion + language,
 * used when the real music API call fails or returns nothing.
 */
export const getDummyRecommendations = (emotion, lang = 'english') => {
  const emotionData = dummyData[emotion.toLowerCase()] || dummyData.neutral;
  return emotionData[lang] || emotionData.english;
};