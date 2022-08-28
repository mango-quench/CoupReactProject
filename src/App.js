require('./App.css') 
const React = require('react');

function App() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    console.log(
    'launch component'
    )
    fetch("/")
      .then((res) => res.json())
      .then((data) => setData(data.message));
  }, []);
  console.log('data', data)

  return (
    <div className="App">
      <header className="App-header">
        <p>
          {data}
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
